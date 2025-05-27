/* eslint-disable max-len */
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import logger from '../utils/logger';
import { RequestStatus } from './constants';
import { Request, Response } from './entities';
import { deflate, inflate, gunzip } from 'zlib';
import { promisify } from 'util';
import { ObjectFileStorageService } from '../object-file-storage/object-file-storage.service';
import { createHash, randomUUID } from 'crypto';
import { CacheStorageService } from '../cache-storage/cache-storage.service';
import { FeedTooLargeException } from './exceptions';
import iconv from 'iconv-lite';
import { RequestSource } from './constants/request-source.constants';
import PartitionedRequestsStoreService from '../partitioned-requests-store/partitioned-requests-store.service';
import { PartitionedRequestInsert } from '../partitioned-requests-store/types/partitioned-request.type';
import { request } from 'undici';
import { GetFeedRequestsInputDto } from './dto';

const deflatePromise = promisify(deflate);
const inflatePromise = promisify(inflate);
const gunzipPromise = promisify(gunzip);

const sha1 = createHash('sha1');

const convertHeaderValue = (val?: string | string[] | null) => {
  if (Array.isArray(val)) {
    return val.join(',');
  }

  return val || '';
};

const trimHeadersForStorage = (
  obj?: Record<string, string | undefined>,
): Record<string, string> => {
  if (!obj) {
    return {};
  }

  const trimmed = Object.entries(obj || {}).reduce((acc, [key, val]) => {
    if (val) {
      acc[key.toLowerCase()] = val;
    }

    return acc;
  }, {} as Record<string, string>);

  if (trimmed.authorization) {
    trimmed.authorization = 'SECRET';
  }

  return trimmed;
};

const convertFetchOptionsForHashKey = (options: FetchOptions) => {
  const { headers, ...rest } = options;

  const prunedHeaders = Object.entries(headers || {}).reduce(
    (acc, [key, val]) => {
      // these keys would result in a new hash every time, so ignore it to save space
      if (key !== 'if-none-match' && key !== 'if-modified-since') {
        acc[key] = val;
      }

      return acc;
    },
    {} as Record<string, string>,
  );

  return JSON.stringify({
    ...rest,
    headers: prunedHeaders,
  });
};

interface FetchOptions {
  headers?: Record<string, string>;
  proxyUri?: string;
}

interface FetchResponse {
  ok: boolean;
  status: number;
  headers: Map<string, string>;
  text: () => Promise<string>;
}

@Injectable()
export class FeedFetcherService {
  defaultUserAgent: string;
  feedRequestTimeoutMs: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly objectFileStorageService: ObjectFileStorageService,
    private readonly cacheStorageService: CacheStorageService,
    private readonly partitionedRequestsStore: PartitionedRequestsStoreService,
  ) {
    this.defaultUserAgent = this.configService.getOrThrow(
      'FEED_REQUESTS_FEED_REQUEST_DEFAULT_USER_AGENT',
    );
    this.feedRequestTimeoutMs = this.configService.getOrThrow(
      'FEED_REQUESTS_REQUEST_TIMEOUT_MS',
    );
  }

  async getRequests({
    skip,
    limit,
    url,
    lookupKey,
    afterDate,
    beforeDate,
  }: GetFeedRequestsInputDto) {
    return this.partitionedRequestsStore.getRequests({
      limit,
      skip,
      url,
      lookupKey,
      afterDate,
      beforeDate,
    });
  }

  async getLatestRetryDate({
    lookupKey,
  }: {
    lookupKey: string;
  }): Promise<Date | null> {
    return this.partitionedRequestsStore.getLatestNextRetryDate(lookupKey);
  }

  async getLatestRequest({
    url,
    lookupKey,
  }: {
    url: string;
    lookupKey: string | undefined;
  }): Promise<{
    request: Request;
    decodedResponseText: string | null | undefined;
  } | null> {
    const request =
      await this.partitionedRequestsStore.getLatestRequestWithResponseBody(
        lookupKey || url,
      );

    if (!request) {
      return null;
    }

    if (request.response?.redisCacheKey || request.response?.content) {
      let compressedText: string | null = null;

      if (request.response.content) {
        compressedText = request.response.content;
      } else if (request.response.redisCacheKey) {
        compressedText = await this.cacheStorageService.getFeedHtmlContent({
          key: request.response.redisCacheKey,
        });
      }

      const text = compressedText
        ? (
            await inflatePromise(Buffer.from(compressedText, 'base64'))
          ).toString()
        : '';

      return {
        request,
        decodedResponseText: text,
      };
    }

    return { request, decodedResponseText: '' };
  }

  async fetchAndSaveResponse(
    url: string,
    options?: {
      lookupDetails:
        | {
            key: string;
          }
        | undefined;
      saveResponseToObjectStorage?: boolean;
      headers?: Record<string, string | undefined>;
      source: RequestSource | undefined;
    },
  ): Promise<{
    request: PartitionedRequestInsert;
    responseText?: string | null;
  }> {
    const fetchOptions: FetchOptions = {
      headers: {
        'user-agent':
          this.configService.get<string>('feedUserAgent') ||
          this.defaultUserAgent,
        accept: 'text/html,text/xml,application/xml,application/rss+xml',
        'accept-encoding': 'gzip',
        /**
         * Currently required for https://developer.oculus.com/blog/rss/ that returns 400 otherwise
         * Appears to be temporary error given that the page says they're working on fixing it
         */
        'Sec-Fetch-Mode': 'navigate',
        'sec-fetch-site': 'none',
        ...options?.headers,
      },
    };
    const request = new Request();
    request.source = options?.source;
    request.lookupKey = options?.lookupDetails?.key || url;
    request.url = url;
    request.fetchOptions = {
      ...fetchOptions,
      headers: trimHeadersForStorage(fetchOptions.headers),
    };

    try {
      if (options?.saveResponseToObjectStorage) {
        logger.info(
          `DEBUG: Fetching ${url} and saving to object storage for url ${url}`,
        );
      }

      const res = await this.fetchFeedResponse(
        url,
        fetchOptions,
        options?.saveResponseToObjectStorage,
      );

      if (res.ok || res.status === HttpStatus.NOT_MODIFIED) {
        request.status = RequestStatus.OK;
      } else {
        request.status = RequestStatus.BAD_STATUS_CODE;
      }

      const response = new Response();
      response.statusCode = res.status;
      const headersToStore: Record<string, string> = {};

      res.headers.forEach((val, key) => {
        headersToStore[key] = val;
      });

      response.headers = headersToStore;

      let text: string | null = null;

      try {
        text = res.status === HttpStatus.NOT_MODIFIED ? '' : await res.text();

        if (request.status !== RequestStatus.OK) {
          logger.debug(`Bad status code ${res.status} for url ${url}`, {
            responseText: text,
          });
        }

        const sizeOfTextInMb = Buffer.byteLength(text) / 1024 / 1024;

        // if (sizeOfTextInMb > 7) {
        //   throw new FeedTooLargeException(`Response body is too large`);
        // }

        try {
          const deflated = await deflatePromise(text);
          const compressedText = deflated.toString('base64');

          if (options?.saveResponseToObjectStorage) {
            response.s3ObjectKey = randomUUID();

            try {
              await this.objectFileStorageService.uploadFeedHtmlContent({
                key: response.s3ObjectKey,
                body: compressedText,
              });
            } catch (err) {
              logger.error(
                `Failed to upload feed hmtl content to object file storage`,
                {
                  stack: (err as Error).stack,
                },
              );
            }
          }

          const key =
            url +
            convertFetchOptionsForHashKey(request.fetchOptions) +
            res.status.toString();

          if (text.length) {
            response.responseHashKey = sha1.copy().update(key).digest('hex');

            response.content = compressedText;
          }
        } catch (err) {
          if (err instanceof FeedTooLargeException) {
            throw err;
          }

          logger.error(
            `Failed to upload feed html content for url ${url} to cache`,
            {
              stack: (err as Error).stack,
            },
          );
        }
      } catch (err) {
        if (err instanceof FeedTooLargeException) {
          request.status = RequestStatus.REFUSED_LARGE_FEED;
        } else {
          request.status = RequestStatus.PARSE_ERROR;
          logger.debug(`Failed to parse response text of url ${url}`, {
            stack: (err as Error).stack,
          });
        }
      }

      const isCloudflareServer = !!res.headers
        .get('server')
        ?.includes('cloudflare');

      response.isCloudflare = isCloudflareServer;
      request.response = response;

      const partitionedRequest: PartitionedRequestInsert = {
        id: randomUUID(),
        url: request.url,
        lookupKey: request.lookupKey,
        createdAt: response.createdAt,
        requestInitiatedAt: request.createdAt,
        errorMessage: request.errorMessage || null,
        fetchOptions: request.fetchOptions || null,
        nextRetryDate: request.nextRetryDate,
        source: (request.source as RequestSource | null) || null,
        status: request.status,
        response: {
          statusCode: response.statusCode,
          textHash: response.textHash || null,
          s3ObjectKey: response.s3ObjectKey || null,
          redisCacheKey: response.redisCacheKey || null,
          headers: response.headers,
          body:
            response.responseHashKey && response.content
              ? {
                  hashKey: response.responseHashKey,
                  contents: response.content,
                }
              : null,
        },
      };

      if (options?.saveResponseToObjectStorage) {
        logger.info(
          `DEBUG: Marking ${url} for persistence`,
          partitionedRequest,
        );
      }

      return {
        request: partitionedRequest,
        responseText: text,
      };
    } catch (err) {
      logger.debug(`Failed to fetch url ${url}`, {
        stack: (err as Error).stack,
      });

      if (
        err instanceof TypeError &&
        err['cause']?.['code'] === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
      ) {
        request.status = RequestStatus.INVALID_SSL_CERTIFICATE;
        request.errorMessage = err['cause']?.['message'];
      } else if (
        (err as Error).name === 'AbortError' ||
        (err as Error).message.includes('Connect Timeout Error')
      ) {
        request.status = RequestStatus.FETCH_TIMEOUT;
        request.errorMessage =
          `Request took longer than` +
          ` ${this.feedRequestTimeoutMs}ms to complete`;
      } else {
        request.status = RequestStatus.FETCH_ERROR;
        request.errorMessage = `${(err as Error).message} | cause: ${
          (err as Error)['cause']?.['message']
        }`;
      }

      const partitionedRequest: PartitionedRequestInsert = {
        id: randomUUID(),
        url: request.url,
        lookupKey: request.lookupKey,
        createdAt: request.createdAt,
        errorMessage: request.errorMessage || null,
        fetchOptions: request.fetchOptions || null,
        nextRetryDate: request.nextRetryDate,
        source: (request.source as RequestSource | null) || null,
        status: request.status,
        response: null,
        requestInitiatedAt: request.createdAt,
      };

      return { request: partitionedRequest };
    }
  }

  async fetchFeedResponse(
    url: string,
    options?: FetchOptions,
    log?: boolean,
  ): Promise<FetchResponse> {
    const controller = new AbortController();

    const timer = setTimeout(() => {
      controller.abort();
    }, this.feedRequestTimeoutMs);

    // Necessary since passing If-None-Match header with empty string may cause a 200 when expecting 304
    const withoutEmptyHeaderVals = Object.entries(
      options?.headers || {},
    ).reduce((acc, [key, val]) => {
      if (val) {
        acc[key] = val;
      }

      return acc;
    }, {});

    const useOptions = {
      headers: withoutEmptyHeaderVals,
      redirect: 'follow' as const,
      signal: controller.signal,
    };

    if (log) {
      logger.info(`TESTLOGGER: Fetching ${url}`, {
        url,
        options: useOptions,
      });
    }

    const r = await request(url, {
      headers: useOptions.headers,
      signal: useOptions.signal,
      maxRedirections: 10,
    });

    const contentTypes =
      typeof r.headers['content-type'] === 'string'
        ? r.headers['content-type'].split(';')
        : r.headers['content-type'] || [];

    const normalizedHeaders = Object.entries(r.headers).reduce(
      (acc, [key, val]) => {
        if (typeof val === 'string') {
          acc.set(key.toLowerCase(), val);
        }

        return acc;
      },
      new Map<string, string>(),
    );

    clearTimeout(timer);

    const headers: FetchResponse['headers'] = new Map();

    const etag = normalizedHeaders.get('etag');

    if (etag) {
      headers.set('etag', convertHeaderValue(etag));
    }

    const contentType = normalizedHeaders.get('content-type');

    if (contentType) {
      headers.set('content-type', convertHeaderValue(contentType));
    }

    const lastModified = normalizedHeaders.get('last-modified');

    if (lastModified) {
      headers.set('last-modified', convertHeaderValue(lastModified));
    }

    const server = normalizedHeaders.get('server');

    if (server) {
      headers.set('server', convertHeaderValue(server));
    }

    const cacheControl = normalizedHeaders.get('cache-control');

    if (cacheControl) {
      headers.set('cache-control', convertHeaderValue(cacheControl));
    }

    const date = normalizedHeaders.get('date');

    if (date) {
      headers.set('date', convertHeaderValue(date));
    }

    const expires = normalizedHeaders.get('expires');

    if (expires) {
      headers.set('expires', convertHeaderValue(expires));
    }

    return {
      headers,
      ok: r.statusCode >= 200 && r.statusCode < 300,
      status: r.statusCode,
      text: async () => {
        const charset = contentTypes
          .find((s) => s.includes('charset'))
          ?.split('=')[1]
          .trim();

        let responseBuffer: Buffer;

        // handle gzip
        if (r.headers['content-encoding']?.includes('gzip')) {
          responseBuffer = await gunzipPromise(await r.body.arrayBuffer());
        } else {
          responseBuffer = Buffer.from(await r.body.arrayBuffer());
        }

        if (!charset || /utf-*8/i.test(charset)) {
          return responseBuffer.toString();
        }

        const decoded = iconv.decode(responseBuffer, charset).toString();

        return decoded;
      },
    };
  }
}

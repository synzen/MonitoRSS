/* eslint-disable max-len */
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import logger from '../utils/logger';
import { RequestStatus } from './constants';
import { Request, Response } from './entities';
import { GetFeedRequestsInput } from './types';
import { deflate, inflate } from 'zlib';
import { promisify } from 'util';
import { ObjectFileStorageService } from '../object-file-storage/object-file-storage.service';
import { createHash, randomUUID } from 'crypto';
import { CacheStorageService } from '../cache-storage/cache-storage.service';
import { FeedTooLargeException } from './exceptions';
import iconv from 'iconv-lite';
import { RequestSource } from './constants/request-source.constants';
import PartitionedRequestsStoreService from '../partitioned-requests-store/partitioned-requests-store.service';
import { PartitionedRequestInsert } from '../partitioned-requests-store/types/partitioned-request.type';
import { fetch, ProxyAgent } from 'undici';

const deflatePromise = promisify(deflate);
const inflatePromise = promisify(inflate);

const sha1 = createHash('sha1');

const convertHeaderValue = (val?: string | string[] | null) => {
  if (Array.isArray(val)) {
    return val.join(',');
  }

  return val || '';
};

const trimHeadersForStorage = (obj?: HeadersInit) => {
  if (!obj) {
    return obj;
  }

  const newObj: HeadersInit = {};

  for (const key in obj) {
    if (obj[key]) {
      newObj[key] = obj[key];
    }
  }

  if (newObj.authorization) {
    newObj.authorization = 'SECRET';
  }

  return newObj;
};

interface FetchOptions {
  headers?: Record<string, string>;
  proxyUri?: string;
}

interface FetchResponse {
  ok: boolean;
  status: number;
  headers: Map<'etag' | 'last-modified' | 'server' | 'content-type', string>;
  text: () => Promise<string>;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

@Injectable()
export class FeedFetcherService {
  defaultUserAgent: string;
  feedRequestTimeoutMs: number;
  proxyUrl?: string;

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
    this.proxyUrl = this.configService.get('FEED_REQUESTS_PROXY_URL');
  }

  async getRequests({ skip, limit, url }: GetFeedRequestsInput) {
    return this.partitionedRequestsStore.getRequests({
      limit,
      skip,
      url,
    });
  }

  async getLatestRetryDate({
    lookupKey,
  }: {
    lookupKey: string;
  }): Promise<Date | null> {
    return this.partitionedRequestsStore.getLatestNextRetryDate(lookupKey);
  }

  // async getLatestRequestHeaders({
  //   url,
  // }: {
  //   url: string;
  // }): Promise<Response['headers']> {
  //   const request = await this.requestRepo.findOne(
  //     {
  //       url,
  //       status: RequestStatus.OK,
  //     },
  //     {
  //       orderBy: {
  //         createdAt: 'DESC',
  //       },
  //       populate: ['response'],
  //       fields: ['response.headers'],
  //     },
  //   );

  //   if (!request) {
  //     return {};
  //   }

  //   return request.response?.headers || {};
  // }

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
    const request = await this.partitionedRequestsStore.getLatestRequest(
      lookupKey || url,
    );

    if (!request) {
      return null;
    }

    if (request.response?.redisCacheKey) {
      const compressedText = await this.cacheStorageService.getFeedHtmlContent({
        key: request.response.redisCacheKey,
      });

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
      lookupKey: string | undefined;
      flushEntities?: boolean;
      saveResponseToObjectStorage?: boolean;
      headers?: Record<string, string>;
      source: RequestSource | undefined;
    },
  ): Promise<{
    request: PartitionedRequestInsert;
    responseText?: string | null;
  }> {
    const fetchOptions: FetchOptions = {
      headers: {
        ...options?.headers,
        'user-agent':
          this.configService.get<string>('feedUserAgent') ||
          this.defaultUserAgent,
        accept: 'text/html,text/xml,application/xml,application/rss+xml',
        /**
         * Currently required for https://developer.oculus.com/blog/rss/ that returns 400 otherwise
         * Appears to be temporary error given that the page says they're working on fixing it
         */
        'Sec-Fetch-Mode': 'navigate',
        'sec-fetch-site': 'none',
      },
    };
    const request = new Request();
    request.source = options?.source;
    request.lookupKey = options?.lookupKey || url;
    request.url = url;
    request.fetchOptions = {
      ...fetchOptions,
      headers: trimHeadersForStorage(fetchOptions.headers),
    };

    try {
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

      const etag = res.headers.get('etag');
      const lastModified = res.headers.get('last-modified');

      const response = new Response();
      response.createdAt = request.createdAt;
      response.statusCode = res.status;
      response.headers = {};

      if (etag) {
        response.headers.etag = etag;
      }

      if (lastModified) {
        response.headers.lastModified = lastModified;
      }

      let text: string | null = null;

      try {
        text =
          res.status === HttpStatus.NOT_MODIFIED
            ? ''
            : await this.maybeDecodeResponse(res);

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

          response.redisCacheKey = sha1.copy().update(url).digest('hex');
          response.textHash = text
            ? sha1.copy().update(text).digest('hex')
            : '';

          await this.cacheStorageService.setFeedHtmlContent({
            key: response.redisCacheKey,
            body: compressedText,
          });
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
        url: request.url,
        lookupKey: request.lookupKey,
        createdAt: request.createdAt,
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
        },
      };

      await this.partitionedRequestsStore.markForPersistence(
        partitionedRequest,
      );

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
      } else if ((err as Error).name === 'AbortError') {
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
        url: request.url,
        lookupKey: request.lookupKey,
        createdAt: request.createdAt,
        errorMessage: request.errorMessage || null,
        fetchOptions: request.fetchOptions || null,
        nextRetryDate: request.nextRetryDate,
        source: (request.source as RequestSource | null) || null,
        status: request.status,
        response: null,
      };

      await this.partitionedRequestsStore.markForPersistence(
        partitionedRequest,
      );

      return { request: partitionedRequest };
    } finally {
      if (options?.flushEntities) {
        await this.partitionedRequestsStore.flushPendingInserts();
      }
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

    const useOptions = {
      headers: {
        ...options?.headers,
      },
      redirect: 'follow' as const,
      signal: controller.signal,
    };

    if (log) {
      logger.info(`TESTLOGGER: Fetching ${url}`, {
        url,
        options: useOptions,
      });
    }

    let agent: ProxyAgent | undefined;

    if (options?.proxyUri) {
      agent = new ProxyAgent({
        connect: {
          timeout: this.feedRequestTimeoutMs,
        },
        uri: options.proxyUri,
      });
    }

    const r = await fetch(url, { ...useOptions, dispatcher: agent });

    clearTimeout(timer);

    const headers: FetchResponse['headers'] = new Map();

    headers.set('etag', convertHeaderValue(r.headers.get('etag')));
    headers.set(
      'content-type',
      convertHeaderValue(r.headers.get('content-type')),
    );
    headers.set(
      'last-modified',
      convertHeaderValue(r.headers.get('last-modified')),
    );
    headers.set('server', convertHeaderValue(r.headers.get('server')));

    if (
      !options?.proxyUri &&
      this.proxyUrl &&
      r.status === HttpStatus.TOO_MANY_REQUESTS
    ) {
      return this.fetchFeedResponse(
        url,
        { ...options, proxyUri: this.proxyUrl },
        log,
      );
    }

    return {
      headers,
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      text: () => r.text(),
      arrayBuffer: () => r.arrayBuffer(),
    };
  }

  private async maybeDecodeResponse(
    res: Awaited<FetchResponse>,
  ): Promise<string> {
    const charset = res.headers
      .get('content-type')
      ?.split(';')
      .find((s) => s.includes('charset'))
      ?.split('=')[1]
      .trim();

    if (!charset || /utf-*8/i.test(charset)) {
      return res.text();
    }

    const arrBuffer = await res.arrayBuffer();
    const decoded = iconv.decode(Buffer.from(arrBuffer), charset).toString();

    return decoded;
  }
}

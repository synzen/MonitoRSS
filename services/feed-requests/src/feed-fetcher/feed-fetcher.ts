/* eslint-disable max-len */
import contextLogger from '../shared/utils/log-context';
import { deflate, inflate, gunzip } from 'zlib';
import { promisify } from 'util';
import { createHash, randomUUID } from 'crypto';
import iconv from 'iconv-lite';
import { request, interceptors, getGlobalDispatcher } from 'undici';
import type { ObjectFileStorageService } from '../object-file-storage/object-file-storage';
import type { CacheStorageService } from '../cache-storage/cache-storage';
import { resolveUserAgentForUrl } from './user-agent';
import type { PartitionedRequestsStore } from '../stores/postgres/partitioned-requests-store';
import {
  RequestSource,
  RequestStatus,
  type PartitionedRequestInsert,
  type Request,
  type Response,
} from '../shared/types';

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

  const trimmed = Object.entries(obj || {}).reduce(
    (acc, [key, val]) => {
      if (val) {
        acc[key.toLowerCase()] = val;
      }

      return acc;
    },
    {} as Record<string, string>,
  );

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

interface FetchError extends Error {
  code?: string;
  cause?: {
    code?: string;
    message?: string;
  };
}

export interface FeedFetcherService {
  getLatestRequest(params: {
    url: string;
    lookupKey: string | undefined;
  }): Promise<{
    request: Request;
    decodedResponseText: string | null | undefined;
  } | null>;
  getLatestRequestNon304(params: {
    url: string;
    lookupKey: string | undefined;
  }): Promise<{
    request: Request;
    decodedResponseText: string | null | undefined;
  } | null>;
  decodeResponseContent(
    compressedContent: string | null | undefined,
  ): Promise<string>;
  fetchAndSaveResponse(
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
  }>;
  fetchFeedResponse(
    url: string,
    options?: FetchOptions,
    log?: boolean,
  ): Promise<FetchResponse>;
}

export function createFeedFetcherService({
  defaultUserAgent,
  requestTimeoutMs,
  objectFileStorage,
  cacheStorage,
  partitionedRequestsStore,
}: {
  defaultUserAgent: string;
  requestTimeoutMs: number;
  objectFileStorage: ObjectFileStorageService;
  cacheStorage: CacheStorageService;
  partitionedRequestsStore: PartitionedRequestsStore;
}): FeedFetcherService {
  const feedRequestTimeoutMs = requestTimeoutMs;

  const decodeStoredResponseText = async (
    request: Request,
  ): Promise<string | null> => {
    if (request.response?.redisCacheKey || request.response?.content) {
      let compressedText: string | null = null;

      if (request.response.content) {
        compressedText = request.response.content;
      } else if (request.response.redisCacheKey) {
        compressedText = await cacheStorage.getFeedHtmlContent({
          key: request.response.redisCacheKey,
        });
      }

      return compressedText
        ? (
            await inflatePromise(Buffer.from(compressedText, 'base64'))
          ).toString()
        : '';
    }

    return null;
  };

  return {
    async getLatestRequest({ url, lookupKey }) {
      const request =
        await partitionedRequestsStore.getLatestRequestWithResponseBody(
          lookupKey || url,
        );

      if (!request) {
        return null;
      }

      const decodedResponseText = await decodeStoredResponseText(request);

      if (decodedResponseText === null) {
        return { request, decodedResponseText: '' };
      }

      return { request, decodedResponseText };
    },

    async getLatestRequestNon304({ url, lookupKey }) {
      const request = await partitionedRequestsStore.getLatestRequestNon304(
        lookupKey || url,
      );

      if (!request) {
        return null;
      }

      const decodedResponseText = await decodeStoredResponseText(request);

      if (decodedResponseText === null) {
        return { request, decodedResponseText: '' };
      }

      return { request, decodedResponseText };
    },

    /**
     * Decode compressed response content from a request.
     * Used by delivery preview to get the body from any request status.
     */
    async decodeResponseContent(compressedContent) {
      if (!compressedContent) {
        return '';
      }

      try {
        const decompressed = await inflatePromise(
          Buffer.from(compressedContent, 'base64'),
        );

        return decompressed.toString();
      } catch {
        return '';
      }
    },

    async fetchAndSaveResponse(url, options) {
      const restHeaders: Record<string, string> = {};
      let explicitUserAgent: string | undefined;

      for (const [key, val] of Object.entries(options?.headers || {})) {
        if (key.toLowerCase() === 'user-agent') {
          explicitUserAgent = val as string;
        } else {
          restHeaders[key] = val as string;
        }
      }

      const resolvedUserAgent =
        explicitUserAgent || resolveUserAgentForUrl(url, defaultUserAgent);

      const fetchOptions: FetchOptions = {
        headers: {
          'user-agent': resolvedUserAgent,
          accept: 'text/html,text/xml,application/xml,application/rss+xml',
          'accept-encoding': 'gzip',
          /**
           * Currently required for https://developer.oculus.com/blog/rss/ that returns 400 otherwise
           * Appears to be temporary error given that the page says they're working on fixing it
           */
          'Sec-Fetch-Mode': 'navigate',
          'sec-fetch-site': 'none',
          ...restHeaders,
        },
      };

      const requestId = randomUUID();

      const requestModel: Request = {
        id: requestId,
        status: RequestStatus.FETCH_ERROR,
        source: options?.source,
        lookupKey: options?.lookupDetails?.key || url,
        url,
        createdAt: new Date(),
        nextRetryDate: null,
        response: null,
        fetchOptions: {
          ...fetchOptions,
          headers: trimHeadersForStorage(fetchOptions.headers),
        },
      };

      try {
        if (options?.saveResponseToObjectStorage) {
          contextLogger.info(`Fetching ${url} and saving to object storage`);
        }

        const res = await this.fetchFeedResponse(
          url,
          fetchOptions,
          options?.saveResponseToObjectStorage,
        );

        if (res.ok || res.status === 304) {
          requestModel.status = RequestStatus.OK;
        } else {
          requestModel.status = RequestStatus.BAD_STATUS_CODE;
        }

        const response: Response = {
          id: requestId,
          statusCode: res.status,
          isCloudflare: false,
          createdAt: new Date(),
          responseHashKey: null,
          content: null,
          headers: {},
          textHash: null,
          s3ObjectKey: null,
          redisCacheKey: null,
          hasCompressedText: false,
        };

        const headersToStore: Record<string, string> = {};

        res.headers.forEach((val, key) => {
          headersToStore[key] = val;
        });

        response.headers = headersToStore;

        let text: string | null = null;

        try {
          text = res.status === 304 ? '' : await res.text();

          if (requestModel.status !== RequestStatus.OK) {
            contextLogger.debug(
              `Bad status code ${res.status} for url ${url}`,
              {
                responseText: text,
              },
            );
          }

          try {
            const deflated = await deflatePromise(text);
            const compressedText = deflated.toString('base64');

            if (options?.saveResponseToObjectStorage) {
              response.s3ObjectKey = randomUUID();

              try {
                await objectFileStorage.uploadFeedHtmlContent({
                  key: response.s3ObjectKey,
                  body: compressedText,
                });
              } catch (err) {
                contextLogger.error(
                  `Failed to upload feed hmtl content to object file storage`,
                  {
                    stack: (err as Error).stack,
                  },
                );
              }
            }

            const key =
              url +
              convertFetchOptionsForHashKey(requestModel.fetchOptions!) +
              res.status.toString();

            if (text.length) {
              response.responseHashKey = sha1.copy().update(key).digest('hex');

              response.content = compressedText;
            }
          } catch (err) {
            contextLogger.error(
              `Failed to upload feed html content for url ${url} to cache`,
              {
                stack: (err as Error).stack,
              },
            );
          }
        } catch (err) {
          requestModel.status = RequestStatus.PARSE_ERROR;
          contextLogger.debug(`Failed to parse response text of url ${url}`, {
            stack: (err as Error).stack,
          });
        }

        const isCloudflareServer = !!res.headers
          .get('server')
          ?.includes('cloudflare');

        response.isCloudflare = isCloudflareServer;
        requestModel.response = response;

        const partitionedRequest: PartitionedRequestInsert = {
          id: requestId,
          url: requestModel.url,
          lookupKey: requestModel.lookupKey,
          createdAt: response.createdAt,
          requestInitiatedAt: requestModel.createdAt,
          errorMessage: requestModel.errorMessage || null,
          fetchOptions: requestModel.fetchOptions || null,
          nextRetryDate: requestModel.nextRetryDate,
          source: (requestModel.source as RequestSource | null) || null,
          status: requestModel.status,
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
          contextLogger.info(
            `Marking ${url} for persistence`,
            partitionedRequest,
          );
        }

        return {
          request: partitionedRequest,
          responseText: text,
        };
      } catch (err) {
        const fetchError = err as FetchError;
        const errorCode = fetchError.code || fetchError.cause?.code;

        contextLogger.debug(`Failed to fetch url ${url}`, {
          stack: fetchError.stack,
        });

        if (
          errorCode === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
          fetchError.message?.includes('unable to get local issuer certificate')
        ) {
          requestModel.status = RequestStatus.INVALID_SSL_CERTIFICATE;
          requestModel.errorMessage =
            fetchError.cause?.message || fetchError.message;
        } else if (
          fetchError.name === 'AbortError' ||
          fetchError.message.includes('Connect Timeout Error')
        ) {
          requestModel.status = RequestStatus.FETCH_TIMEOUT;
          requestModel.errorMessage =
            `Request took longer than` +
            ` ${feedRequestTimeoutMs}ms to complete`;
        } else {
          requestModel.status = RequestStatus.FETCH_ERROR;
          requestModel.errorMessage = `${fetchError.message} | cause: ${fetchError.cause?.message}`;
        }

        const partitionedRequest: PartitionedRequestInsert = {
          id: requestId,
          url: requestModel.url,
          lookupKey: requestModel.lookupKey,
          createdAt: requestModel.createdAt,
          errorMessage: requestModel.errorMessage || null,
          fetchOptions: requestModel.fetchOptions || null,
          nextRetryDate: requestModel.nextRetryDate,
          source: (requestModel.source as RequestSource | null) || null,
          status: requestModel.status,
          response: null,
          requestInitiatedAt: requestModel.createdAt,
        };

        return { request: partitionedRequest };
      }
    },

    async fetchFeedResponse(url, options, log) {
      const controller = new AbortController();

      const timer = setTimeout(() => {
        controller.abort();
      }, feedRequestTimeoutMs);

      // Necessary since passing If-None-Match header with empty string may cause a 200 when expecting 304
      const withoutEmptyHeaderVals = Object.entries(
        options?.headers || {},
      ).reduce(
        (acc, [key, val]) => {
          if (val) {
            acc[key] = val;
          }

          return acc;
        },
        {} as Record<string, string>,
      );

      const useOptions = {
        headers: withoutEmptyHeaderVals,
        redirect: 'follow' as const,
        signal: controller.signal,
      };

      if (log) {
        contextLogger.info(`Fetching ${url}`, {
          url,
          options: useOptions,
        });
      }

      const r = await request(url, {
        headers: useOptions.headers,
        signal: useOptions.signal,
        dispatcher: getGlobalDispatcher().compose(
          interceptors.redirect({ maxRedirections: 10 }),
        ),
      }).finally(() => clearTimeout(timer));

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

      const headers: FetchResponse['headers'] = new Map();

      // Only these headers are persisted; insertion order is preserved into
      // the JSON stored in the database.
      for (const headerName of [
        'etag',
        'content-type',
        'last-modified',
        'server',
        'cache-control',
        'date',
        'expires',
      ]) {
        const value = normalizedHeaders.get(headerName);

        if (value) {
          headers.set(headerName, convertHeaderValue(value));
        }
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
    },
  };
}

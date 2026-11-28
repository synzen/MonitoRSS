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
import {
  NoProviderAvailableError,
  PlatformProviderFetchError,
  type PlatformFeedDocument,
  type PlatformHttpGet,
  type PlatformProviderRouter,
} from '../platform-providers/types';
import type { PartitionedRequestsStore } from '../stores/postgres/partitioned-requests-store';
import {
  RequestSource,
  RequestStatus,
  type PartitionedRequestInsert,
  type Request,
  type Response,
} from './types';

const deflatePromise = promisify(deflate);
const inflatePromise = promisify(inflate);
const gunzipPromise = promisify(gunzip);

const sha1 = createHash('sha1');

/**
 * Hosts that content-negotiate on accept and serve their HTML page instead of
 * the XML when "text/html" appears in the accept header (e.g. rssground.com),
 * which the parser then rejects.
 */
const CUSTOM_ACCEPT_HEADERS_BY_HOST = new Map<string, string>([
  [
    'www.rssground.com',
    'application/rss+xml,application/xml,text/xml,*/*;q=0.8',
  ],
]);

const resolveAcceptHeaderForUrl = (url: string): string => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    return (
      CUSTOM_ACCEPT_HEADERS_BY_HOST.get(hostname) ??
      'text/html,text/xml,application/xml,application/rss+xml'
    );
  } catch {
    return 'text/html,text/xml,application/xml,application/rss+xml';
  }
};

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

// Credentialed platform fetches carry the user grant as the item's
// Authorization header (backend-api attaches it per feed); adapters receive
// the raw token rather than header plumbing. Header names arrive verbatim,
// so the lookup is case-insensitive.
const extractBearerToken = (
  headers?: Record<string, string | undefined>,
): string | undefined => {
  const value = Object.entries(headers || {}).find(([key]) =>
    key.toLowerCase().startsWith('authorization'),
  )?.[1];

  return value?.replace(/^Bearer\s+/i, '') || undefined;
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
  // POST support for platform provider adapters reaching vendor APIs.
  method?: string;
  body?: string;
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
      usePlatformProvider?: boolean;
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
  platformResponseFreshnessSeconds,
  objectFileStorage,
  cacheStorage,
  partitionedRequestsStore,
  platformSourceRouterFactory,
}: {
  defaultUserAgent: string;
  requestTimeoutMs: number;
  platformResponseFreshnessSeconds?: number;
  objectFileStorage: ObjectFileStorageService;
  cacheStorage: CacheStorageService;
  partitionedRequestsStore: PartitionedRequestsStore;
  platformSourceRouterFactory?: (
    httpGet: PlatformHttpGet,
  ) => PlatformProviderRouter;
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

  // The platform-providers router reuses the service's own HTTP GET, so it is
  // wired after the service object exists; route() only runs at fetch time.
  let platformSourceRouter: PlatformProviderRouter | null = null;

  const service: FeedFetcherService = {
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
          accept: resolveAcceptHeaderForUrl(url),
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

        // Platform destination URLs fetch through a provider adapter instead
        // of a plain HTTP GET of the feed URL; the adapter's normalized RSS
        // document is treated as a 200 response body so persistence, hashing
        // and parsing run unchanged. The adapter call is eager so its errors
        // map into the failure taxonomy, not the text-parsing path. A matched
        // platform the deployment has no provider for stays on the normal
        // fetch path; a misconfigured provider name still fails the fetch.
        const matchedPlatformRoute = (() => {
          try {
            return platformSourceRouter?.route(url) ?? null;
          } catch (err) {
            if (err instanceof NoProviderAvailableError) {
              return null;
            }

            throw err;
          }
        })();
        const platformRoute =
          matchedPlatformRoute &&
          (options?.usePlatformProvider ||
            matchedPlatformRoute.identity.platform === 'reddit')
            ? matchedPlatformRoute
            : null;
        contextLogger.debug(
          `Resolved fetch route for ${url}: ${
            platformRoute
              ? `platform:${platformRoute.identity.platform}`
              : 'standard-http'
          }`,
          {
            usePlatformProvider: options?.usePlatformProvider === true,
            matchedPlatform: matchedPlatformRoute?.identity.platform ?? null,
          },
        );
        const platformFetch: PlatformFeedDocument | null = platformRoute
          ? await platformRoute.adapter.fetchFeedDocument(
              platformRoute.identity,
              {
                // Credentialed providers (e.g. redditofficial) fetch with the
                // batch item's user grant; storage redacts it afterwards.
                bearerToken: extractBearerToken(options?.headers),
              },
            )
          : null;
        // The provider's own response freshness wins; adapters that report
        // none keep the configured fallback.
        const platformFreshnessSeconds =
          platformFetch?.freshnessSeconds ?? platformResponseFreshnessSeconds;

        const res =
          platformRoute && platformFetch !== null
            ? {
                ok: true,
                status: 200,
                headers: new Map([
                  ['content-type', 'application/rss+xml'],
                  // A response that reports no reusable window (no-store /
                  // max-age=0) omits the directive, so the scheduler refetches
                  // on every due tick. Otherwise it lets the freshness skip
                  // reuse this stored document for repeat fetches of the same
                  // URL within the window (feeds sharing a source across
                  // refresh-rate tiers) instead of paying a second provider
                  // call.
                  ...(platformFreshnessSeconds
                    ? ([
                        [
                          'cache-control',
                          `public, max-age=${platformFreshnessSeconds}`,
                        ],
                      ] as const)
                    : []),
                ]),
                text: async () => platformFetch.document,
              }
            : await this.fetchFeedResponse(
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

        if (err instanceof PlatformProviderFetchError) {
          requestModel.status = err.requestStatus;
          requestModel.errorMessage = err.message;

          if (err.statusCode === 429) {
            contextLogger.warn(`Platform fetch rate-limited for url ${url}`, {
              statusCode: err.statusCode,
              url,
              lookupKey: requestModel.lookupKey,
              errorMessage: err.message,
            });
          }

          // A provider response failure keeps its status code on the row so
          // consumers map it through the existing status-code taxonomy
          // (e.g. a 404 for a non-existent resource).
          if (
            err.statusCode &&
            err.requestStatus === RequestStatus.BAD_STATUS_CODE
          ) {
            requestModel.response = {
              id: requestId,
              statusCode: err.statusCode,
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
          }
        } else if (
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
          response: requestModel.response
            ? {
                statusCode: requestModel.response.statusCode,
                textHash: null,
                s3ObjectKey: null,
                redisCacheKey: null,
                headers: {},
                body: null,
              }
            : null,
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
        method: options?.method,
        body: options?.body,
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
        // The retry backoff (ADR-011) reads this from the stored row.
        'retry-after',
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

  if (platformSourceRouterFactory) {
    platformSourceRouter = platformSourceRouterFactory((url, options) =>
      service.fetchFeedResponse(url, options),
    );
  }

  return service;
}

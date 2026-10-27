/* eslint-disable max-len */
import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import * as util from 'util';
import compress from '@fastify/compress';
import dayjs from 'dayjs';
import qs from 'qs';
import logger from '../utils/logger';
import type { FeedFetcherService } from '../feed-fetcher/feed-fetcher';
import {
  fetchFeedInputSchema,
  fetchFeedDeliveryPreviewInputSchema,
  getFeedRequestsQuerySchema,
  parseWithMessages,
  type FetchFeedDetails,
  type FetchFeedInput,
} from '../feed-fetcher/schemas';
import { RequestStatus } from '../shared/types';
import type { PartitionedRequestsStore } from '../stores/postgres/partitioned-requests-store';
import type { HostRateLimiterService } from '../host-rate-limiter/host-rate-limiter';
import calculateResponseFreshnessLifetime from '../shared/utils/calculate-response-freshness-lifetime';

const HTTP_STATUS_NOT_MODIFIED = 304;

// Reproduces the three log records the pre-migration AllExceptionsFilter
// emitted for every HttpException (guard 403s, not-found, validation 400s);
// log-based alerting may match on them. Winston merges the meta object's own
// enumerable props into the record and appends meta.message/meta.stack, so
// the synthetic error carries the HttpException instance's fields.
function logHttpException(
  request: FastifyRequest,
  exception: {
    name: string;
    message: string | string[];
    response: Record<string, unknown>;
  },
) {
  const exceptionMeta = Object.assign(new Error(String(exception.message)), {
    name: exception.name,
    response: exception.response,
    status: exception.response.statusCode,
  });

  logger.error(exception.message as string, exceptionMeta);
  logger.error(`HTTP Exception - ${exception.message}`, {
    exception: exceptionMeta.stack || exceptionMeta,
    http: {
      method: request.method,
      url: request.url,
      res: exception.response,
    },
  });
  logger.error(`HTTP Exception: ${exception.message}`, exceptionMeta);
}

// Mirrors the pre-migration Nest BaseExceptionFilter's isHttpError: only
// Fastify errors, http-errors signatures, and non-Error http-shaped values
// keep their own status code; every other error is a 500.
function getErrorStatusCode(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') {
    return undefined;
  }

  const error = err as FastifyError & {
    status?: unknown;
    expose?: unknown;
    message?: unknown;
  };

  if (
    error.constructor?.name === 'FastifyError' &&
    typeof error.code === 'string' &&
    typeof error.statusCode === 'number'
  ) {
    return error.statusCode;
  }

  if (
    typeof error.expose === 'boolean' &&
    typeof error.statusCode === 'number' &&
    error.status === error.statusCode &&
    err instanceof Error
  ) {
    return error.statusCode;
  }

  if (
    !(err instanceof Error) &&
    Number.isInteger(error.statusCode) &&
    (error.statusCode as number) >= 400 &&
    (error.statusCode as number) < 600 &&
    typeof error.message === 'string' &&
    error.message !== ''
  ) {
    return error.statusCode;
  }

  return undefined;
}

export interface HttpAppDeps {
  apiKey: string;
  feedFetcher: FeedFetcherService;
  partitionedRequestsStore: PartitionedRequestsStore;
  hostRateLimiter: HostRateLimiterService;
}

export function createApp(deps: HttpAppDeps): FastifyInstance {
  const app = Fastify({
    logger: false,
  });

  void app.register(compress, {
    encodings: ['gzip', 'deflate'],
  });

  const requireApiKey = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    if (request.headers['api-key'] !== deps.apiKey) {
      const response = {
        statusCode: 403,
        message: 'Forbidden resource',
        error: 'Forbidden',
      };

      logHttpException(request, {
        name: 'ForbiddenException',
        message: response.message,
        response,
      });

      return reply.code(403).send(response);
    }
  };

  app.setNotFoundHandler((request, reply) => {
    const response = {
      statusCode: 404,
      message: `Cannot ${request.method} ${request.url}`,
      error: 'Not Found',
    };

    logHttpException(request, {
      name: 'NotFoundException',
      message: response.message,
      response,
    });

    reply.code(404).send(response);
  });

  app.setErrorHandler((err, request, reply) => {
    const error = err as Error;

    logger.error(`Unhandled error - ${error.message || util.inspect(error)}`, {
      exception: error.stack || error,
    });

    const statusCode = getErrorStatusCode(err);

    if (statusCode !== undefined) {
      // Fastify body-parser failures (malformed JSON, oversized bodies, wrong
      // media types) keep their own status code and message, matching the
      // pre-migration BaseExceptionFilter's handling of http-shaped errors.
      return reply.code(statusCode).send({
        statusCode,
        message: error.message,
      });
    }

    return reply.code(500).send({
      statusCode: 500,
      message: 'Internal server error',
    });
  });

  app.get('/v1/feed-requests/health', async () => {
    return {
      ok: 1,
    };
  });

  app.get(
    '/v1/feed-requests',
    {
      preHandler: requireApiKey,
    },
    async (request, reply) => {
      // Query parsing semantics (nested objects via qs) must match the
      // pre-migration nested-query decorator, which parsed the raw query
      // string off the url.
      const queryString = request.url.split('?')[1];
      const parsedQuery = parseWithMessages(
        getFeedRequestsQuerySchema,
        qs.parse(queryString),
      );

      if (!parsedQuery.success) {
        const response = {
          statusCode: 400,
          message: parsedQuery.messages,
          error: 'Bad Request',
        };

        logHttpException(request, {
          name: 'BadRequestException',
          message: parsedQuery.messages,
          response,
        });

        return reply.code(400).send(response);
      }

      const dto = parsedQuery.data;
      const requests = await deps.partitionedRequestsStore.getRequests(dto);

      const nextRetryDate =
        requests[0] && requests[0].status !== RequestStatus.OK
          ? await deps.partitionedRequestsStore.getLatestNextRetryDate(
              dto.lookupKey || dto.url,
            )
          : null;

      const globalRateLimit = deps.hostRateLimiter.getLimitForUrl(dto.url);

      return {
        result: {
          requests: requests.map((r) => ({
            createdAt: dayjs(r.createdAt).unix(),
            finishedAtIso: r.finishedAt.toISOString(),
            createdAtIso: r.createdAt.toISOString(),
            id: r.id,
            url: r.url,
            status: r.status,
            headers: r.fetchOptions?.headers,
            nextRetryAtIso: r.nextRetryDate
              ? dayjs(r.nextRetryDate).toISOString()
              : null,
            response: {
              statusCode: r.response?.statusCode,
              headers: r.response?.headers,
            },
            freshnessLifetimeMs: calculateResponseFreshnessLifetime({
              headers: r.response?.headers || {},
            }).capped,
          })),
          // unix timestamp in seconds
          nextRetryTimestamp: nextRetryDate
            ? dayjs(nextRetryDate).unix()
            : null,
          feedHostGlobalRateLimit: globalRateLimit
            ? {
                intervalSec: globalRateLimit.data.intervalSec,
                requestLimit: globalRateLimit.data.requestLimit,
              }
            : null,
        },
      };
    },
  );

  app.post(
    '/v1/feed-requests',
    {
      preHandler: requireApiKey,
    },
    async (request, reply) => {
      const parsedBody = parseWithMessages(fetchFeedInputSchema, request.body);

      if (!parsedBody.success) {
        const response = {
          statusCode: 400,
          message: parsedBody.messages,
          error: 'Bad Request',
        };

        logHttpException(request, {
          name: 'BadRequestException',
          message: parsedBody.messages,
          response,
        });

        return reply.code(400).send(response);
      }

      return getLatestRequest(deps, parsedBody.data);
    },
  );

  app.post(
    '/v1/feed-requests/delivery-preview',
    {
      preHandler: requireApiKey,
    },
    async (request, reply) => {
      const parsedBody = parseWithMessages(
        fetchFeedDeliveryPreviewInputSchema,
        request.body,
      );

      if (!parsedBody.success) {
        const response = {
          statusCode: 400,
          message: parsedBody.messages,
          error: 'Bad Request',
        };

        logHttpException(request, {
          name: 'BadRequestException',
          message: parsedBody.messages,
          response,
        });

        return reply.code(400).send(response);
      }

      const data = parsedBody.data;
      const lookupKey = data.lookupKey || data.url;

      // 1. Get latest request (any status, including errors)
      let latestRequest =
        await deps.partitionedRequestsStore.getLatestRequestAnyStatus(
          lookupKey,
        );

      // 2. Check staleness
      const threshold =
        data.stalenessThresholdSeconds ?? DEFAULT_STALENESS_THRESHOLD_SECONDS;
      const isStale =
        !latestRequest || isStaleSince(latestRequest.createdAt, threshold);

      // 3. If stale, fetch new
      if (isStale) {
        await fetchAndFlush(deps, data.url, {
          lookupDetails: data.lookupKey ? { key: data.lookupKey } : undefined,
          headers: data.headers as Record<string, string> | undefined,
          source: undefined,
        });

        // Re-fetch latest
        latestRequest =
          await deps.partitionedRequestsStore.getLatestRequestAnyStatus(
            lookupKey,
          );
      }

      // 4. Map to response
      if (!latestRequest) {
        return { requestStatus: 'FETCH_ERROR' as const };
      }

      // Check for hash match before mapping status
      if (
        data.hashToCompare &&
        latestRequest.response?.textHash &&
        data.hashToCompare === latestRequest.response.textHash
      ) {
        return { requestStatus: 'MATCHED_HASH' as const };
      }

      // Handle 304 Not Modified - get body from last successful request with content
      if (latestRequest.response?.statusCode === HTTP_STATUS_NOT_MODIFIED) {
        const lastWithBody =
          await deps.partitionedRequestsStore.getLatestRequestWithResponseBody(
            lookupKey,
          );

        if (lastWithBody?.response?.content) {
          latestRequest = {
            ...latestRequest,
            response: {
              ...latestRequest.response,
              content: lastWithBody.response.content,
              textHash: lastWithBody.response.textHash,
            },
          };
        }
      }

      const decodedBody = await deps.feedFetcher.decodeResponseContent(
        latestRequest.response?.content,
      );

      return mapStatusToResponse(
        latestRequest.status,
        latestRequest.response,
        decodedBody,
      );
    },
  );

  return app;
}

/**
 * Maps a request status and response to FetchFeedDetails.
 * Shared between delivery preview and regular feed request endpoints.
 */
const DEFAULT_STALENESS_THRESHOLD_SECONDS = 1800;

function buildFetchAndSaveOptions(data: FetchFeedInput) {
  return {
    saveResponseToObjectStorage: data.debug,
    lookupDetails: data.lookupDetails,
    source: undefined,
    headers: data.lookupDetails?.headers as Record<string, string> | undefined,
  };
}

const isStaleSince = (createdAt: Date, thresholdSeconds: number) =>
  dayjs().diff(createdAt, 'second') > thresholdSeconds;

async function fetchAndFlush(
  deps: HttpAppDeps,
  url: string,
  options?: Parameters<FeedFetcherService['fetchAndSaveResponse']>[1],
) {
  const result = await deps.feedFetcher.fetchAndSaveResponse(url, options);

  await deps.partitionedRequestsStore.flushInserts([result.request]);

  return result;
}

function mapStatusToResponse(
  status: RequestStatus,
  response: { textHash?: string | null; statusCode: number } | null,
  body: string,
): FetchFeedDetails {
  if (status === RequestStatus.INVALID_SSL_CERTIFICATE) {
    return { requestStatus: 'INVALID_SSL_CERTIFICATE' as const };
  }

  if (status === RequestStatus.REFUSED_LARGE_FEED) {
    return { requestStatus: 'REFUSED_LARGE_FEED' as const };
  }

  if (status === RequestStatus.FETCH_TIMEOUT) {
    return { requestStatus: 'FETCH_TIMEOUT' as const };
  }

  if (status === RequestStatus.FETCH_ERROR || !response) {
    return { requestStatus: 'FETCH_ERROR' as const };
  }

  if (status === RequestStatus.OK) {
    return {
      requestStatus: 'SUCCESS' as const,
      response: {
        hash: response.textHash,
        body,
        statusCode: response.statusCode,
      },
    };
  }

  if (status === RequestStatus.PARSE_ERROR) {
    return {
      requestStatus: 'PARSE_ERROR' as const,
      response: { statusCode: response.statusCode },
    };
  }

  if (status === RequestStatus.INTERNAL_ERROR) {
    return { requestStatus: 'INTERNAL_ERROR' as const };
  }

  if (status === RequestStatus.BAD_STATUS_CODE) {
    return {
      requestStatus: 'BAD_STATUS_CODE' as const,
      response: { statusCode: response.statusCode },
    };
  }

  throw new Error(`Unhandled request status: ${status}`);
}

async function getLatestRequest(
  deps: HttpAppDeps,
  data: FetchFeedInput,
): Promise<FetchFeedDetails> {
  if (data.executeFetch) {
    try {
      await fetchAndFlush(deps, data.url, buildFetchAndSaveOptions(data));
    } catch (err) {
      logger.error(`Failed to fetch and save response of feed ${data.url}`, {
        stack: (err as Error).stack,
      });

      throw err;
    }
  }

  const lookupParams = {
    url: data.url,
    lookupKey: data.lookupDetails?.key,
  };

  let latestRequest: {
    request: {
      response: {
        textHash?: string | null;
        statusCode: number;
        redisCacheKey?: string | null;
      } | null;
      status: RequestStatus;
      createdAt: Date;
    };
    decodedResponseText?: string | null;
  } | null = await deps.feedFetcher.getLatestRequest(lookupParams);

  const stalenessThresholdSeconds =
    data.stalenessThresholdSeconds ?? DEFAULT_STALENESS_THRESHOLD_SECONDS;
  const isStale =
    latestRequest &&
    isStaleSince(latestRequest.request.createdAt, stalenessThresholdSeconds);

  if (data.executeFetchIfStale && isStale) {
    await fetchAndFlush(deps, data.url, buildFetchAndSaveOptions(data));
    latestRequest = await deps.feedFetcher.getLatestRequest(lookupParams);
  }

  // If there's no request with a response body, try to get latest non-304 request
  // (this will return errors like SSL certificate issues to the user)
  if (!latestRequest) {
    latestRequest = await deps.feedFetcher.getLatestRequestNon304(lookupParams);

    // Check staleness on error records too - a stale error should not prevent
    // a fresh fetch attempt (e.g. a transient network error days ago)
    if (latestRequest && data.executeFetchIfStale) {
      const isErrorStale = isStaleSince(
        latestRequest.request.createdAt,
        stalenessThresholdSeconds,
      );

      if (isErrorStale) {
        await fetchAndFlush(deps, data.url, buildFetchAndSaveOptions(data));

        // Try to get a request with body first (in case the re-fetch succeeded)
        latestRequest = await deps.feedFetcher.getLatestRequest(lookupParams);

        if (!latestRequest) {
          latestRequest =
            await deps.feedFetcher.getLatestRequestNon304(lookupParams);
        }
      }
    }
  }

  // Only fetch fresh if there's no non-304 request
  // (meaning either all requests are 304, or there are no requests at all)
  if (!latestRequest) {
    const savedData = await fetchAndFlush(
      deps,
      data.url,
      buildFetchAndSaveOptions(data),
    );

    latestRequest = {
      request: { ...savedData.request },
      decodedResponseText: savedData.responseText,
    };
  }

  // Check for hash match before mapping status
  if (
    data.hashToCompare &&
    latestRequest.request.response?.textHash &&
    data.hashToCompare === latestRequest.request.response?.textHash
  ) {
    return {
      requestStatus: 'MATCHED_HASH' as const,
    };
  }

  return mapStatusToResponse(
    latestRequest.request.status,
    latestRequest.request.response,
    latestRequest.decodedResponseText ?? '',
  );
}

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
} from '../feed-fetcher/schemas';
import { createFetchFeedFlow } from '../feed-fetcher/fetch-feed';
import { RequestStatus } from '../feed-fetcher/types';
import type { PartitionedRequestsStore } from '../stores/postgres/partitioned-requests-store';
import type { HostRateLimiterService } from '../host-rate-limiter/host-rate-limiter';
import calculateResponseFreshnessLifetime from '../feed-fetcher/calculate-response-freshness-lifetime';

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

  const fetchFeedFlow = createFetchFeedFlow({
    feedFetcher: deps.feedFetcher,
    partitionedRequestsStore: deps.partitionedRequestsStore,
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

      return fetchFeedFlow.fetchFeed(parsedBody.data);
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

      return fetchFeedFlow.fetchFeedDeliveryPreview(parsedBody.data);
    },
  );

  return app;
}

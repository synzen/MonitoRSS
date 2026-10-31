/* eslint-disable max-len */
import dayjs from 'dayjs';
import logger from '../utils/logger';
import contextLogger, { logContextStorage } from '../shared/utils/log-context';
import retryUntilTrue, {
  RetryException,
} from '../shared/utils/retry-until-true';
import calculateResponseFreshnessLifetime from './calculate-response-freshness-lifetime';
import calculateCurrentResponseAge from './calculate-current-response-age';
import type { FeedFetcherService } from './feed-fetcher';
import type { PartitionedRequestInsert } from './types';
import { RequestSource, RequestStatus } from './types';
import type { PartitionedRequestsStore } from '../stores/postgres/partitioned-requests-store';
import type { HostRateLimiterService } from '../host-rate-limiter/host-rate-limiter';
import type { CacheStorageService } from '../cache-storage/cache-storage';
import type {
  UrlFailedDisableFeedsPayload,
  UrlFetchBatchPayload,
  UrlFetchCompletedPayload,
  UrlFailingPayload,
  UrlRejectedDisableFeedsPayload,
} from '@monitorss/contracts';

type BatchRequestMessage = UrlFetchBatchPayload;
type BatchRequestItem = UrlFetchBatchPayload['data'][number];

const BASE_FAILED_ATTEMPT_WAIT_MINUTES = 5;

// Response-reuse window for scheduled-occurrence fetches: long enough to
// collapse duplicate same-URL entries processed together in one batch, short
// enough that a feed's next scheduled occurrence fetches fresh.
const SCHEDULED_DEDUPE_WINDOW_SECONDS = 120;

/**
 * Domain events emitted while processing scheduled fetch batches. The
 * transport layer maps these to broker queues (see the consumer shell).
 */
export type ScheduledFetchEvent =
  | { kind: 'url-rejected'; data: UrlRejectedDisableFeedsPayload['data'] }
  | { kind: 'url-failed'; data: UrlFailedDisableFeedsPayload['data'] }
  | { kind: 'url-failing'; data: UrlFailingPayload['data'] }
  | { kind: 'fetch-completed'; data: UrlFetchCompletedPayload['data'] };

export interface ScheduledFetchProcessor {
  processBatch(batchRequest: BatchRequestMessage): Promise<void>;
}

export function calculateNextRetryDate(
  referenceDate: Date,
  attemptsSoFar: number,
): Date {
  const minutesToWait =
    BASE_FAILED_ATTEMPT_WAIT_MINUTES * Math.pow(2, attemptsSoFar);

  return dayjs(referenceDate).add(minutesToWait, 'minute').toDate();
}

/**
 * The store-bound policies of the scheduled fetch flow, extractable from the
 * processor for direct testing.
 */
export interface ScheduledFetchPolicies {
  isLatestResponseStillFreshInCache(params: { lookupKey: string }): Promise<{
    isCacheStillActive: boolean;
    freshnessLifetimeMs?: number;
    responseAgeMs?: number;
    latestOkRequest?: Awaited<
      ReturnType<PartitionedRequestsStore['getLatestRequestWithOkStatus']>
    >;
  }>;
  countFailedRequests(params: {
    lookupKey?: string;
    url: string;
    // `since` is meaningful as null: null counts every failure, while
    // undefined falls back to counting failures since the latest OK request.
    since?: Date | null;
  }): Promise<number>;
  shouldSkipAfterPreviousFailedAttempt(params: {
    lookupKey?: string;
    url: string;
    recoveryStartedAt?: number;
  }): Promise<{
    skip: boolean;
    failedAttemptsCount: number;
    nextRetryDate?: Date | null;
    thresholdExceeded?: boolean;
  }>;
}

export function createScheduledFetchPolicies({
  maxFailAttempts,
  partitionedRequestsStore,
}: {
  maxFailAttempts: number;
  partitionedRequestsStore: Pick<
    PartitionedRequestsStore,
    | 'getLatestRequestWithOkStatus'
    | 'countFailedRequests'
    | 'getLatestNextRetryDate'
  >;
}): ScheduledFetchPolicies {
  async function isLatestResponseStillFreshInCache({
    lookupKey,
  }: {
    lookupKey: string;
  }) {
    const latestOkRequest =
      await partitionedRequestsStore.getLatestRequestWithOkStatus(lookupKey, {
        fields: ['response_headers'],
      });

    if (!latestOkRequest) {
      return {
        isCacheStillActive: false,
      };
    }

    const { capped: freshnessLifetime } = calculateResponseFreshnessLifetime({
      headers: latestOkRequest.responseHeaders || {},
    });

    const currentAgeOfResponse = calculateCurrentResponseAge({
      headers: latestOkRequest.responseHeaders || {},
      requestTime: latestOkRequest.createdAt,
      responseTime: latestOkRequest?.requestInitiatedAt,
    });

    const responseIsFresh = freshnessLifetime > currentAgeOfResponse;

    return {
      latestOkRequest,
      isCacheStillActive: freshnessLifetime ? responseIsFresh : false,
      freshnessLifetimeMs: freshnessLifetime,
      responseAgeMs: currentAgeOfResponse,
    };
  }

  async function countFailedRequests({
    lookupKey,
    url,
    since,
  }: {
    lookupKey?: string;
    url: string;
    // `since` is meaningful as null: null counts every failure, while
    // undefined falls back to counting failures since the latest OK request.
    since?: Date | null;
  }) {
    const effectiveSince =
      since !== undefined
        ? (since ?? undefined)
        : (
            await partitionedRequestsStore.getLatestRequestWithOkStatus(
              lookupKey || url,
              {},
            )
          )?.createdAt;

    return partitionedRequestsStore.countFailedRequests(
      lookupKey || url,
      effectiveSince,
    );
  }

  async function shouldSkipAfterPreviousFailedAttempt({
    lookupKey,
    url,
    recoveryStartedAt,
  }: {
    lookupKey?: string;
    url: string;
    recoveryStartedAt?: number;
  }) {
    const key = lookupKey || url;

    const latestOkRequest =
      await partitionedRequestsStore.getLatestRequestWithOkStatus(key, {});
    const shouldStartNewRecoveryCycle =
      recoveryStartedAt !== undefined &&
      (!latestOkRequest ||
        latestOkRequest.createdAt.getTime() < recoveryStartedAt);
    const failureCycleStart = shouldStartNewRecoveryCycle
      ? new Date(recoveryStartedAt)
      : (latestOkRequest?.createdAt ?? null);

    const failedAttempts = await countFailedRequests({
      lookupKey: key,
      url,
      since: failureCycleStart,
    });

    if (failedAttempts === 0) {
      return {
        skip: false,
        failedAttemptsCount: 0,
      };
    }

    if (failedAttempts >= maxFailAttempts) {
      return {
        skip: true,
        failedAttemptsCount: failedAttempts,
        thresholdExceeded: true,
      };
    }

    const latestNextRetryDate =
      await partitionedRequestsStore.getLatestNextRetryDate(
        key,
        recoveryStartedAt !== undefined
          ? (failureCycleStart ?? undefined)
          : undefined,
      );

    if (!latestNextRetryDate) {
      // Failures recorded by non-broker paths (e.g. direct API fetches) do
      // not carry retry dates, so this is reachable without a data issue.
      contextLogger.warn(
        `Request for ${key} has previously failed, but there is no` +
          ` nextRetryDate set. Failed requests that did not go through the` +
          ` broker do not have retry dates. Continuing with request as` +
          ` fallback behavior.`,
      );

      return {
        skip: false,
        failedAttemptsCount: failedAttempts,
      };
    }

    if (dayjs().isBefore(latestNextRetryDate)) {
      return {
        skip: true,
        nextRetryDate: latestNextRetryDate,
        failedAttemptsCount: failedAttempts,
      };
    }

    return {
      skip: false,
      failedAttemptsCount: failedAttempts,
    };
  }

  return {
    isLatestResponseStillFreshInCache,
    countFailedRequests,
    shouldSkipAfterPreviousFailedAttempt,
  };
}

export function createScheduledFetchProcessor({
  maxFailAttempts,
  feedFetcher,
  partitionedRequestsStore,
  hostRateLimiter,
  cacheStorage,
  onEvent,
}: {
  maxFailAttempts: number;
  feedFetcher: Pick<FeedFetcherService, 'fetchAndSaveResponse'>;
  partitionedRequestsStore: Pick<
    PartitionedRequestsStore,
    | 'flushInserts'
    | 'wasRequestedInPastSeconds'
    | 'getLatestRequestWithOkStatus'
    | 'countFailedRequests'
    | 'getLatestNextRetryDate'
  >;
  hostRateLimiter: Pick<HostRateLimiterService, 'incrementUrlCount'>;
  cacheStorage: Pick<CacheStorageService, 'setNX' | 'del'>;
  onEvent: (event: ScheduledFetchEvent) => void;
}): ScheduledFetchProcessor {
  const policies = createScheduledFetchPolicies({
    maxFailAttempts,
    partitionedRequestsStore,
  });

  function calculateProcessingCacheKeyForMessage(
    event: BatchRequestItem,
    rateSeconds: number,
  ) {
    const lookupKey = event.lookupKey || event.url;

    // Scope the lock by refresh rate. Feeds sharing a URL but on different
    // refresh rates each get their own lock, so a fast-refreshing feed can't
    // starve a slower one by holding a URL-wide lock and causing its cycles to
    // be skipped (which drops the fetch-completed event and delays delivery).
    // Scheduled occurrences are scoped by their occurrence time too: two
    // entries for the same URL with different occurrences (or a scheduled
    // entry racing an interval one) must not swallow each other's completed
    // event via the lock (ADR-009).
    const triggerScope =
      event.trigger?.kind === 'scheduled' ? `-${event.trigger.occurredAt}` : '';

    return `listener-service-${lookupKey}-${rateSeconds}${triggerScope}`;
  }

  async function processScheduledFetch(
    data: BatchRequestItem & Pick<BatchRequestMessage, 'rateSeconds'>,
  ): Promise<{
    emitFetchCompleted: boolean;
    request?: PartitionedRequestInsert;
  }> {
    const url = data.url;
    const rateSeconds = data.rateSeconds;
    const lookupKey = data.lookupKey;

    const { skip, nextRetryDate, failedAttemptsCount, thresholdExceeded } =
      await policies.shouldSkipAfterPreviousFailedAttempt({
        lookupKey,
        url,
        recoveryStartedAt: data.recovery?.startedAt,
      });

    if (thresholdExceeded) {
      onEvent({
        kind: 'url-failed',
        data: {
          lookupKey,
          url,
          recovery:
            data.recovery?.startedAt !== undefined
              ? { startedAt: data.recovery.startedAt }
              : undefined,
        },
      });
    }

    if (skip) {
      contextLogger.debug(
        `Request ${url} with rate ${rateSeconds} has ` +
          `recently failed and will be skipped until ${nextRetryDate}`,
      );

      return { emitFetchCompleted: false };
    }

    const {
      isCacheStillActive,
      latestOkRequest,
      freshnessLifetimeMs,
      responseAgeMs,
    } = await policies.isLatestResponseStillFreshInCache({
      lookupKey: lookupKey || url,
    });

    // Recovery attempts ignore a still-fresh cached response: the point of the
    // cycle is to verify the URL with a fresh request, not to trust the cache
    // built before the outage.
    if (isCacheStillActive && !data.recovery) {
      const cacheSkipMessage =
        `Request with lookup key ${lookupKey || url} still has active` +
        ` cache-control, skipping fetch but emitting fetch completed`;

      if (data.saveToObjectStorage) {
        contextLogger.info(cacheSkipMessage, {
          freshnessLifetimeMs,
          responseAgeMs,
          rateSeconds,
        });
      } else {
        contextLogger.debug(cacheSkipMessage);
      }

      // The cached response may have been fetched by a cycle of a different
      // refresh rate on the same URL, whose fetch-completed event only
      // triggers delivery for feeds on that rate. Feeds on this rate must
      // still be notified or they starve until timing happens to align.
      return { emitFetchCompleted: true };
    }

    if (data.saveToObjectStorage) {
      contextLogger.info(
        `About to fetch and save response for ${url} for refresh rate ${data.rateSeconds}s`,
      );
    }

    const { request } = await feedFetcher.fetchAndSaveResponse(url, {
      saveResponseToObjectStorage: data.saveToObjectStorage,
      lookupDetails: data.lookupKey
        ? {
            key: data.lookupKey,
          }
        : undefined,
      source: RequestSource.Schedule,
      headers: {
        ...data.headers,
        'If-Modified-Since':
          latestOkRequest?.responseHeaders?.['last-modified'] || '',
        'If-None-Match': latestOkRequest?.responseHeaders?.etag,
      },
    });

    if (request.status === RequestStatus.REFUSED_LARGE_FEED) {
      onEvent({
        kind: 'url-rejected',
        data: {
          url,
          status: RequestStatus.REFUSED_LARGE_FEED,
          lookupKey,
        },
      });
    } else if (request.status !== RequestStatus.OK) {
      const nextRetryDate = calculateNextRetryDate(
        new Date(),
        failedAttemptsCount,
      );

      onEvent({ kind: 'url-failing', data: { lookupKey, url } });

      contextLogger.debug(
        `Request with url ${url} failed, next retry date: ${nextRetryDate}`,
      );

      request.nextRetryDate = nextRetryDate;
    }

    return {
      request,
      emitFetchCompleted: request.status === RequestStatus.OK,
    };
  }

  return {
    async processBatch(batchRequest: BatchRequestMessage) {
      const rateSeconds = batchRequest.rateSeconds;
      const fetchCompletedToEmit: UrlFetchCompletedPayload['data'][] = [];
      const requestInsertsToFlush: PartitionedRequestInsert[] = [];

      const results = await Promise.allSettled(
        batchRequest.data.map(async (message) => {
          const {
            url,
            lookupKey,
            saveToObjectStorage,
            headers,
            recovery,
            trigger,
          } = message;
          const logPrefix = saveToObjectStorage
            ? `DEBUG ${lookupKey || url}:`
            : '';

          return logContextStorage.run({ prefix: logPrefix }, async () => {
            let request: PartitionedRequestInsert | undefined = undefined;

            if (saveToObjectStorage) {
              contextLogger.info(
                `Beginning to process fetch request in batch request for ${url} with rate ${rateSeconds}s`,
              );
            }

            const cacheKey = calculateProcessingCacheKeyForMessage(
              message,
              rateSeconds,
            );
            const lockExpSeconds = Math.min(
              Math.floor(rateSeconds * 0.75),
              120,
            );
            const wasSet = await cacheStorage.setNX({
              key: cacheKey,
              body: '1',
              expSeconds: lockExpSeconds,
            });

            if (!wasSet) {
              contextLogger.info(
                `Request with key ${
                  lookupKey || url
                } with rate ${rateSeconds} is already being processed, skipping`,
              );

              return;
            }

            try {
              // Recovery attempts must perform a fresh request even if the URL
              // was recently processed by a prior (terminal-failure) cycle.
              // Scheduled occurrences only reuse a response fetched moments
              // ago (a duplicate entry for the same URL in the same batch); a
              // long window would let one occurrence serve another feed's
              // adjacent scheduled time a stale response.
              const dedupeWindowSeconds =
                trigger?.kind === 'scheduled'
                  ? SCHEDULED_DEDUPE_WINDOW_SECONDS
                  : Math.round(rateSeconds * 0.5);
              const recentlyProcessed = recovery
                ? false
                : await partitionedRequestsStore.wasRequestedInPastSeconds(
                    lookupKey || url,
                    dedupeWindowSeconds,
                  );

              if (recentlyProcessed) {
                contextLogger.info(
                  `Request with key ${
                    lookupKey || url
                  } with rate ${rateSeconds} was recently processed, skipping`,
                );

                fetchCompletedToEmit.push({
                  lookupKey,
                  url,
                  rateSeconds,
                  debug: saveToObjectStorage,
                  recovery,
                  trigger,
                });

                return;
              }

              await retryUntilTrue(
                async () => {
                  const { isRateLimited } =
                    await hostRateLimiter.incrementUrlCount(url);

                  if (isRateLimited) {
                    contextLogger.info(
                      `Host of ${url} is still rate limited, retrying later`,
                    );
                  }

                  return !isRateLimited;
                },
                5000,
                (rateSeconds * 1000) / 1.5, // 1.5 is the backoff factor of retryUntilTrue
              );

              const result = await processScheduledFetch({
                lookupKey,
                url,
                rateSeconds,
                saveToObjectStorage,
                headers,
                recovery,
              });

              if (result) {
                request = result.request;
              }

              if (result.request) {
                requestInsertsToFlush.push(result.request);
              }

              if (result.emitFetchCompleted) {
                fetchCompletedToEmit.push({
                  lookupKey,
                  url,
                  rateSeconds,
                  debug: saveToObjectStorage,
                  recovery,
                  trigger,
                });
              }
            } catch (err) {
              if (err instanceof RetryException) {
                contextLogger.error(
                  `Error while retrying due to host rate limits: ${err.message}`,
                  {
                    event: message,
                    err: (err as Error).stack,
                  },
                );
              } else {
                contextLogger.error(`Error processing fetch request message`, {
                  event: message,
                  err: (err as Error).stack,
                });
              }
            } finally {
              if (batchRequest.timestamp) {
                const nowTs = Date.now();
                const finishedTs = nowTs - batchRequest.timestamp;

                contextLogger.datadog(
                  `Finished handling feed requests batch event URL in ${finishedTs}s`,
                  {
                    duration: finishedTs,
                    url,
                    lookupKey,
                    requestStatus: request?.status,
                    statusCode: request?.response?.statusCode,
                    errorMessage: request?.errorMessage,
                  },
                );
              }

              await cacheStorage.del(cacheKey);
            }
          });
        }),
      );

      for (let i = 0; i < results.length; ++i) {
        const res = results[i];

        if (res.status === 'fulfilled') {
          continue;
        }

        logger.error(`Error processing a message within batch request`, {
          reason: res.reason instanceof Error ? res.reason.stack : res.reason,
        });
      }

      await partitionedRequestsStore.flushInserts(requestInsertsToFlush);

      fetchCompletedToEmit.forEach((data) => {
        onEvent({ kind: 'fetch-completed', data });
      });

      if (batchRequest.data.some((d) => d.saveToObjectStorage)) {
        logger.info(
          `DEBUG: Finished processing fetch batch request message for urls for refresh rate ${batchRequest.rateSeconds}s. Flushed pending inserts.`,
        );
      }
    },
  };
}

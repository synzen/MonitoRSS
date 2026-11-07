/* eslint-disable max-len */
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

// Backoff probe tiers (ADR-011): interval ceilings while a URL is suspended.
// Boundaries live in config; the intervals themselves are policy constants.
const TIER_INTERVALS_MS = [3_600_000, 6 * 3_600_000, 24 * 3_600_000];

export interface BackoffConfig {
  suspensionBaseMs: number;
  suspensionRateMultiplier: number;
  tier1BoundaryMs: number;
  tier2BoundaryMs: number;
  expiryMs: number;
  rateLimitFloorMs: number;
  retryAfterClampMs: number;
}

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

function parseRetryAfterMs(
  value: string | undefined,
  nowMs: number,
): number | null {
  if (!value) {
    return null;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds)) {
    return seconds * 1000;
  }

  const dateMs = Date.parse(value);

  return Number.isNaN(dateMs) ? null : dateMs - nowMs;
}

/**
 * Interval before the next fetch attempt for a URL, derived from the time
 * since its last success (ADR-011). The active phase keeps the feed's own
 * cadence — failures never push the next attempt further out than the feed
 * pays for. After suspension the probe tiers take over, and rate-limit
 * responses (429/503) floor the interval at their Retry-After (or a default).
 */
export function calculateBackoffIntervalMs(params: {
  elapsedMs: number;
  rateSeconds: number;
  lastAttempt?: {
    statusCode: number | null;
    headers: Record<string, string> | null;
  } | null;
  config: BackoffConfig;
  nowMs?: number;
}): number {
  const {
    elapsedMs,
    rateSeconds,
    lastAttempt,
    config,
    nowMs = Date.now(),
  } = params;
  const rateMs = rateSeconds * 1000;
  const suspensionThresholdMs = Math.max(
    config.suspensionBaseMs,
    config.suspensionRateMultiplier * rateMs,
  );

  let intervalMs = rateMs;

  if (elapsedMs >= suspensionThresholdMs) {
    const tierIntervalMs =
      elapsedMs >= config.tier2BoundaryMs
        ? TIER_INTERVALS_MS[2]
        : elapsedMs >= config.tier1BoundaryMs
          ? TIER_INTERVALS_MS[1]
          : TIER_INTERVALS_MS[0];

    intervalMs = Math.max(tierIntervalMs, rateMs);
  }

  if (
    lastAttempt &&
    (lastAttempt.statusCode === 429 || lastAttempt.statusCode === 503)
  ) {
    const retryAfterMs = parseRetryAfterMs(
      lastAttempt.headers?.['retry-after'],
      nowMs,
    );
    const flooredMs = Math.min(
      config.retryAfterClampMs,
      Math.max(retryAfterMs ?? 0, config.rateLimitFloorMs),
    );

    intervalMs = Math.max(intervalMs, flooredMs);
  }

  return intervalMs;
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
  getBackoffDecision(params: {
    lookupKey?: string;
    url: string;
    rateSeconds: number;
    force?: boolean;
  }): Promise<{
    skip: boolean;
    expired: boolean;
    nextRetryDate: Date | null;
    elapsedMs: number;
  }>;
}

export function createScheduledFetchPolicies({
  backoffConfig,
  partitionedRequestsStore,
}: {
  backoffConfig: BackoffConfig;
  partitionedRequestsStore: Pick<
    PartitionedRequestsStore,
    | 'getLatestRequestWithOkStatus'
    | 'getLatestAttempt'
    | 'getEarliestRequestCreatedAt'
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

  /**
   * Derived-state backoff decision (ADR-011): the interval is computed from the
   * request rows on every tick, so there is no stored backoff state to
   * persist or reset. The active phase never skips — scheduled ticks arrive
   * at the feed cadence and every one of them fetches. Only tiers or
   * rate-limit floors longer than the cadence gate the next attempt.
   */
  async function getBackoffDecision({
    lookupKey,
    url,
    rateSeconds,
    force,
  }: {
    lookupKey?: string;
    url: string;
    rateSeconds: number;
    force?: boolean;
  }): Promise<{
    skip: boolean;
    expired: boolean;
    nextRetryDate: Date | null;
    elapsedMs: number;
  }> {
    const key = lookupKey || url;
    const latestOkRequest =
      await partitionedRequestsStore.getLatestRequestWithOkStatus(key, {});

    let anchorMs: number | null = latestOkRequest?.createdAt.getTime() ?? null;

    if (anchorMs === null) {
      // Never-succeeded URLs anchor the clock at their first request.
      const earliest =
        await partitionedRequestsStore.getEarliestRequestCreatedAt(key);

      anchorMs = earliest?.getTime() ?? null;
    }

    if (anchorMs === null) {
      return { skip: false, expired: false, nextRetryDate: null, elapsedMs: 0 };
    }

    const elapsedMs = Date.now() - anchorMs;

    // Forced (bulk-retry) fetches bypass the skip and expiry logic but still
    // report the true elapsed time, so failure rows record truthful
    // observability intervals.
    if (force) {
      return { skip: false, expired: false, nextRetryDate: null, elapsedMs };
    }

    if (elapsedMs >= backoffConfig.expiryMs) {
      return { skip: true, expired: true, nextRetryDate: null, elapsedMs };
    }

    const latestAttempt = await partitionedRequestsStore.getLatestAttempt(key);
    const intervalMs = calculateBackoffIntervalMs({
      elapsedMs,
      rateSeconds,
      lastAttempt: latestAttempt
        ? {
            statusCode: latestAttempt.statusCode,
            headers: latestAttempt.responseHeaders ?? null,
          }
        : null,
      config: backoffConfig,
    });

    if (
      intervalMs > rateSeconds * 1000 &&
      latestAttempt &&
      Date.now() < latestAttempt.createdAt.getTime() + intervalMs
    ) {
      return {
        skip: true,
        expired: false,
        nextRetryDate: new Date(latestAttempt.createdAt.getTime() + intervalMs),
        elapsedMs,
      };
    }

    return { skip: false, expired: false, nextRetryDate: null, elapsedMs };
  }

  return {
    isLatestResponseStillFreshInCache,
    getBackoffDecision,
  };
}

export function createScheduledFetchProcessor({
  backoffConfig,
  feedFetcher,
  partitionedRequestsStore,
  hostRateLimiter,
  cacheStorage,
  onEvent,
}: {
  backoffConfig: BackoffConfig;
  feedFetcher: Pick<FeedFetcherService, 'fetchAndSaveResponse'>;
  partitionedRequestsStore: Pick<
    PartitionedRequestsStore,
    | 'flushInserts'
    | 'wasRequestedInPastSeconds'
    | 'getLatestRequestWithOkStatus'
    | 'getLatestAttempt'
    | 'getEarliestRequestCreatedAt'
  >;
  hostRateLimiter: Pick<HostRateLimiterService, 'incrementUrlCount'>;
  cacheStorage: Pick<CacheStorageService, 'setNX' | 'del'>;
  onEvent: (event: ScheduledFetchEvent) => void;
}): ScheduledFetchProcessor {
  const policies = createScheduledFetchPolicies({
    backoffConfig,
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

    const { skip, expired, nextRetryDate, elapsedMs } =
      await policies.getBackoffDecision({
        lookupKey,
        url,
        rateSeconds,
        force: data.force,
      });

    if (expired) {
      // The retry backoff gave up (ADR-011): 14 days of continuous failure.
      // Emissions past expiry repeat per tick; the consumer dedupes via its
      // not-yet-disabled feed lookup.
      onEvent({
        kind: 'url-failed',
        data: {
          lookupKey,
          url,
        },
      });
    }

    if (skip) {
      contextLogger.debug(
        expired
          ? `Request ${url} with rate ${rateSeconds} expired on the retry backoff, skipping`
          : `Request ${url} with rate ${rateSeconds} has ` +
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
    // built before the outage. Forced (bulk-retry) fetches do too.
    if (isCacheStillActive && !data.recovery && !data.force) {
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
      // nextRetryDate is observability only (ADR-011): the real schedule is
      // derived from the request rows on the next tick.
      const nextRetryDate = new Date(
        Date.now() +
          calculateBackoffIntervalMs({
            elapsedMs,
            rateSeconds,
            lastAttempt: {
              statusCode: request.response?.statusCode ?? null,
              headers:
                (request.response?.headers as Record<string, string> | null) ??
                null,
            },
            config: backoffConfig,
          }),
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
            force,
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
              // Forced (bulk-retry) fetches bypass the backoff and dedupe too.
              // Scheduled occurrences only reuse a response fetched moments
              // ago (a duplicate entry for the same URL in the same batch); a
              // long window would let one occurrence serve another feed's
              // adjacent scheduled time a stale response.
              const dedupeWindowSeconds =
                trigger?.kind === 'scheduled'
                  ? SCHEDULED_DEDUPE_WINDOW_SECONDS
                  : Math.round(rateSeconds * 0.5);
              const recentlyProcessed =
                recovery || force
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
                force,
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

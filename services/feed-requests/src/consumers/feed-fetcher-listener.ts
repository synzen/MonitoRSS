/* eslint-disable max-len */
import logger from '../utils/logger';
import dayjs from 'dayjs';
import type { FeedFetcherService } from '../feed-fetcher/feed-fetcher';
import type { PartitionedRequestsStore } from '../stores/postgres/partitioned-requests-store';
import type { PartitionedRequestInsert } from '../shared/types';
import { RequestStatus } from '../shared/types';
import { RequestSource } from '../shared/types';
import type { HostRateLimiterService } from '../host-rate-limiter/host-rate-limiter';
import retryUntilTrue, {
  RetryException,
} from '../shared/utils/retry-until-true';
import calculateResponseFreshnessLifetime from '../shared/utils/calculate-response-freshness-lifetime';
import calculateCurrentResponseAge from '../shared/utils/calculate-current-response-age';
import type { CacheStorageService } from '../cache-storage/cache-storage';
import contextLogger, { logContextStorage } from '../shared/utils/log-context';
import type { Publish } from './rabbitmq';
import {
  UrlFetchBatchSchema,
  UrlFetchCompletedSchema,
  UrlFailingSchema,
  UrlRejectedDisableFeedsSchema,
  type UrlFetchBatchPayload,
  type UrlFetchCompletedPayload,
  UrlFailedDisableFeedsSchema,
  type UrlFailedDisableFeedsPayload,
  MessageBrokerQueue,
} from '@monitorss/contracts';

type BatchRequestMessage = UrlFetchBatchPayload;
type BatchRequestItem = UrlFetchBatchPayload['data'][number];

const BASE_FAILED_ATTEMPT_WAIT_MINUTES = 5;

// Response-reuse window for scheduled-occurrence fetches: long enough to
// collapse duplicate same-URL entries processed together in one batch, short
// enough that a feed's next scheduled occurrence fetches fresh.
const SCHEDULED_DEDUPE_WINDOW_SECONDS = 120;

export interface FeedFetcherListener {
  onBrokerFetchRequestBatch(message: BatchRequestMessage): Promise<void>;
  onBrokerFetchRequestBatchHandler(
    batchRequest: BatchRequestMessage,
  ): Promise<void>;
  shouldSkipAfterPreviousFailedAttempt(params: {
    lookupKey?: string;
    url: string;
    recoveryStartedAt?: number;
  }): Promise<{
    skip: boolean;
    failedAttemptsCount: number;
    nextRetryDate?: Date | null;
  }>;
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
    since?: Date | null;
  }): Promise<number>;
  calculateNextRetryDate(referenceDate: Date, attemptsSoFar: number): Date;
  calculateCurrentlyProcessingCacheKeyForMessage(
    event: BatchRequestItem,
    rateSeconds: number,
  ): string;
  emitRejectedUrl(params: { url: string; lookupKey: string | undefined }): void;
  emitFailedUrl(params: {
    lookupKey?: string;
    url: string;
    recovery?: { startedAt: number };
  }): void;
  emitFailingUrl(params: { lookupKey?: string; url: string }): void;
  emitFetchCompleted(data: UrlFetchCompletedPayload['data']): void;
}

export function createFeedFetcherListener({
  maxFailAttempts,
  feedFetcher,
  partitionedRequestsStore,
  hostRateLimiter,
  cacheStorage,
  publish,
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
  publish: Publish;
}): FeedFetcherListener {
  return {
    calculateCurrentlyProcessingCacheKeyForMessage(event, rateSeconds) {
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
        event.trigger?.kind === 'scheduled'
          ? `-${event.trigger.occurredAt}`
          : '';

      return `listener-service-${lookupKey}-${rateSeconds}${triggerScope}`;
    },

    async onBrokerFetchRequestBatch(message: BatchRequestMessage) {
      logger.datadog(`Received fetch batch request message`, {
        event: message,
      });
      await this.onBrokerFetchRequestBatchHandler(message);
    },

    async onBrokerFetchRequestBatchHandler(batchRequest) {
      // Consumers validate against the shared contract (ADR-007): log + skip on
      // validation failure instead of processing a misshapen message.
      const parsedBatch = UrlFetchBatchSchema.safeParse(batchRequest);

      if (!parsedBatch.success) {
        logger.error(
          `Received fetch batch request message failed contract validation, skipping`,
          {
            issues: parsedBatch.error.issues,
            event: batchRequest,
          },
        );

        return;
      }

      const validatedBatch: BatchRequestMessage = parsedBatch.data;
      const rateSeconds = validatedBatch?.rateSeconds;

      if (!validatedBatch.data || rateSeconds == null) {
        logger.error(
          `Received fetch batch request message has no urls and/or rateSeconds, skipping`,
          {
            event: batchRequest,
          },
        );

        return;
      }

      const fetchCompletedToEmit: UrlFetchCompletedPayload['data'][] = [];
      const requestInsertsToFlush: PartitionedRequestInsert[] = [];

      logger.debug(`Fetch batch request message received for batch urls`, {
        event: batchRequest,
      });

      try {
        const results = await Promise.allSettled(
          validatedBatch.data.map(async (message) => {
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

              const cacheKey =
                this.calculateCurrentlyProcessingCacheKeyForMessage(
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

                const result = await handleBrokerFetchRequest.call(this, {
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
                  contextLogger.error(
                    `Error processing fetch request message`,
                    {
                      event: message,
                      err: (err as Error).stack,
                    },
                  );
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

        fetchCompletedToEmit.forEach((event) => {
          this.emitFetchCompleted(event);
        });

        if (batchRequest.data.some((d) => d.saveToObjectStorage)) {
          logger.info(
            `DEBUG: Finished processing fetch batch request message for urls for refresh rate ${batchRequest.rateSeconds}s. Flushed pending inserts.`,
          );
        }
      } catch (err) {
        logger.error(`Error processing fetch batch request message`, {
          event: batchRequest,
          err: (err as Error).stack,
        });
      }

      async function handleBrokerFetchRequest(
        this: FeedFetcherListener,
        data: BatchRequestItem & Pick<BatchRequestMessage, 'rateSeconds'>,
      ): Promise<{
        emitFetchCompleted: boolean;
        request?: PartitionedRequestInsert;
      }> {
        const url = data.url;
        const rateSeconds = data.rateSeconds;
        const lookupKey = data.lookupKey;

        const { skip, nextRetryDate, failedAttemptsCount } =
          await this.shouldSkipAfterPreviousFailedAttempt({
            lookupKey,
            url,
            recoveryStartedAt: data.recovery?.startedAt,
          });

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
        } = await this.isLatestResponseStillFreshInCache({
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
          this.emitRejectedUrl({ url, lookupKey });
        } else if (request.status !== RequestStatus.OK) {
          const nextRetryDate = this.calculateNextRetryDate(
            new Date(),
            failedAttemptsCount,
          );

          this.emitFailingUrl({ lookupKey, url });

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
    },

    async shouldSkipAfterPreviousFailedAttempt({
      lookupKey,
      url,
      recoveryStartedAt,
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

      const failedAttempts = await this.countFailedRequests({
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
        this.emitFailedUrl({
          lookupKey,
          url,
          ...(recoveryStartedAt
            ? { recovery: { startedAt: recoveryStartedAt } }
            : {}),
        });

        return {
          skip: true,
          failedAttemptsCount: failedAttempts,
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
        contextLogger.error(
          `Request for ${lookupKey} has previously failed, but there is no` +
            ` nextRetryDate set. All failed requests handled via broker events` +
            ` should have retry dates. Continuing with request as fallback behavior.`,
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
    },

    emitRejectedUrl({ url, lookupKey }) {
      try {
        contextLogger.info(
          `Emitting rejected url for feeds with url "${url}", lookupkey ${lookupKey} `,
          {
            url,
            lookupKey,
          },
        );

        const event = {
          data: {
            url,
            status: RequestStatus.REFUSED_LARGE_FEED,
            lookupKey,
          },
        };
        UrlRejectedDisableFeedsSchema.parse(event);
        void publish(MessageBrokerQueue.UrlRejectedDisableFeeds, event).catch(
          (err) => {
            contextLogger.error(
              `Failed to publish rejected url event: ${url}`,
              {
                stack: (err as Error).stack,
                url,
              },
            );
          },
        );
      } catch (err) {
        contextLogger.error(`Failed to publish rejected url event: ${url}`, {
          stack: (err as Error).stack,
          url,
        });
      }
    },

    emitFailedUrl({ lookupKey, url, recovery }) {
      try {
        contextLogger.info(
          `Disabling feeds with lookup key "${lookupKey}" and url ${url} due to failure threshold `,
        );

        const event: UrlFailedDisableFeedsPayload = {
          data: {
            lookupKey,
            url,
            recovery,
          },
        };
        UrlFailedDisableFeedsSchema.parse(event);
        void publish(MessageBrokerQueue.UrlFailedDisableFeeds, event).catch(
          (err) => {
            contextLogger.error(
              `Failed to publish failed url event: ${lookupKey}`,
              {
                stack: (err as Error).stack,
                lookupKey,
              },
            );
          },
        );
      } catch (err) {
        contextLogger.error(
          `Failed to publish failed url event: ${lookupKey}`,
          {
            stack: (err as Error).stack,
            lookupKey,
          },
        );
      }
    },

    emitFailingUrl({ lookupKey, url }) {
      try {
        const event = {
          data: {
            lookupKey,
            url,
          },
        };
        UrlFailingSchema.parse(event);
        void publish(MessageBrokerQueue.UrlFailing, event).catch((err) => {
          contextLogger.error(`Failed to publish failing lookup key event`, {
            stack: (err as Error).stack,
            lookupKey,
          });
        });
      } catch (err) {
        contextLogger.error(`Failed to publish failing lookup key event`, {
          stack: (err as Error).stack,
          lookupKey,
        });
      }
    },

    emitFetchCompleted({
      lookupKey,
      url,
      rateSeconds,
      debug,
      recovery,
      trigger,
    }) {
      try {
        if (debug) {
          contextLogger.info(
            `Publishing url.fetch.completed event for feeds with url "${url}", lookupkey ${lookupKey}`,
            {
              url,
              lookupKey,
              rateSeconds,
            },
          );
        }

        const event = {
          data: { lookupKey, url, rateSeconds, debug, recovery, trigger },
        };
        UrlFetchCompletedSchema.parse(event);
        void publish(MessageBrokerQueue.UrlFetchCompleted, event).catch(
          (err) => {
            contextLogger.error(
              `Failed to publish fetch completed event: ${lookupKey}`,
              {
                stack: (err as Error).stack,
                lookupKey,
              },
            );
          },
        );
      } catch (err) {
        contextLogger.error(
          `Failed to publish fetch completed event: ${lookupKey}`,
          {
            stack: (err as Error).stack,
            lookupKey,
          },
        );
      }
    },

    async isLatestResponseStillFreshInCache({ lookupKey }) {
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
    },

    async countFailedRequests({ lookupKey, url, since }) {
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
    },

    calculateNextRetryDate(referenceDate, attemptsSoFar) {
      const minutesToWait =
        BASE_FAILED_ATTEMPT_WAIT_MINUTES * Math.pow(2, attemptsSoFar);

      return dayjs(referenceDate).add(minutesToWait, 'minute').toDate();
    },
  };
}

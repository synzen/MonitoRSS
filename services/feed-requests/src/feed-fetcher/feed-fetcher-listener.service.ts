/* eslint-disable max-len */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import logger from '../utils/logger';
import { RequestStatus } from './constants';
import dayjs from 'dayjs';
import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { EntityManager } from '@mikro-orm/postgresql';
import { MikroORM, UseRequestContext } from '@mikro-orm/core';
import { FeedFetcherService } from './feed-fetcher.service';
import { RequestSource } from './constants/request-source.constants';
import PartitionedRequestsStoreService from '../partitioned-requests-store/partitioned-requests-store.service';
import { PartitionedRequestInsert } from '../partitioned-requests-store/types/partitioned-request.type';
import { HostRateLimiterService } from '../host-rate-limiter/host-rate-limiter.service';
import retryUntilTrue, {
  RetryException,
} from '../shared/utils/retry-until-true';
import calculateResponseFreshnessLifetime from '../shared/utils/calculate-response-freshness-lifetime';
import calculateCurrentResponseAge from '../shared/utils/calculate-current-response-age';
import { CacheStorageService } from '../cache-storage/cache-storage.service';

interface BatchRequestMessage {
  timestamp: number;
  data: Array<{
    lookupKey?: string;
    url: string;
    saveToObjectStorage?: boolean;
    headers?: Record<string, string>;
  }>;
  rateSeconds: number;
}

@Injectable()
export class FeedFetcherListenerService {
  maxFailAttempts: number;
  defaultUserAgent: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly feedFetcherService: FeedFetcherService,
    private readonly amqpConnection: AmqpConnection,
    private readonly orm: MikroORM, // For @UseRequestContext decorator
    private readonly em: EntityManager,
    private readonly partitionedRequestsStoreService: PartitionedRequestsStoreService,
    private readonly hostRateLimiterService: HostRateLimiterService,
    private readonly cacheStorageService: CacheStorageService,
  ) {
    this.maxFailAttempts = this.configService.get(
      'FEED_REQUESTS_MAX_FAIL_ATTEMPTS',
    ) as number;
    this.defaultUserAgent = this.configService.getOrThrow(
      'FEED_REQUESTS_FEED_REQUEST_DEFAULT_USER_AGENT',
    );
  }

  calculateCurrentlyProcessingCacheKeyForMessage = (
    event: BatchRequestMessage['data'][number],
  ) => {
    const lookupKey = event.lookupKey || event.url;

    return `listener-service-${lookupKey}`;
  };

  static BASE_FAILED_ATTEMPT_WAIT_MINUTES = 5;

  @RabbitSubscribe({
    exchange: '',
    queue: 'url.fetch-batch',
    queueOptions: {
      channel: 'fetchBatch',
    },
    createQueueIfNotExists: true,
  })
  async onBrokerFetchRequestBatch(message: BatchRequestMessage) {
    logger.datadog(`Received fetch batch request message`, {
      event: message,
    });
    await this.onBrokerFetchRequestBatchHandler(message);
  }

  @UseRequestContext()
  private async onBrokerFetchRequestBatchHandler(
    batchRequest: BatchRequestMessage,
  ): Promise<void> {
    const rateSeconds = batchRequest?.rateSeconds;

    if (!batchRequest.data || rateSeconds == null) {
      logger.error(
        `Received fetch batch request message has no urls and/or rateSeconds, skipping`,
        {
          event: batchRequest,
        },
      );

      return;
    }

    const fetchCompletedToEmit: Array<{
      lookupKey?: string;
      url: string;
      rateSeconds: number;
      debug?: boolean;
    }> = [];
    const requestInsertsToFlush: PartitionedRequestInsert[] = [];

    logger.debug(`Fetch batch request message received for batch urls`, {
      event: batchRequest,
    });

    try {
      const results = await Promise.allSettled(
        batchRequest.data.map(async (message) => {
          const { url, lookupKey, saveToObjectStorage, headers } = message;
          let request: PartitionedRequestInsert | undefined = undefined;

          if (saveToObjectStorage) {
            logger.info(
              `DEBUG: Beginning to process fetch request in batch request for ${url} with rate ${rateSeconds}s`,
            );
          }

          const currentlyProcessing = await this.cacheStorageService.set({
            key: this.calculateCurrentlyProcessingCacheKeyForMessage(message),
            body: '1',
            getOldValue: true,
            expSeconds: Math.floor(rateSeconds * 0.75),
          });

          if (currentlyProcessing) {
            logger.info(
              `Request with key ${
                lookupKey || url
              } with rate ${rateSeconds} is already being processed, skipping`,
            );

            return;
          }

          const recentlyProcessed =
            await this.partitionedRequestsStoreService.wasRequestedInPastSeconds(
              lookupKey || url,
              Math.round(rateSeconds * 0.5),
            );

          if (recentlyProcessed) {
            // Check is necessary if a feed is checked on both 10m and 2m intervals for example
            logger.info(
              `Request with key ${
                lookupKey || url
              } with rate ${rateSeconds} was recently processed, skipping`,
            );

            fetchCompletedToEmit.push({
              lookupKey,
              url,
              rateSeconds,
              debug: saveToObjectStorage,
            });

            return;
          }

          try {
            await retryUntilTrue(
              async () => {
                const { isRateLimited } =
                  await this.hostRateLimiterService.incrementUrlCount(url);

                if (isRateLimited) {
                  logger.info(
                    `Host of ${url} is still rate limited, retrying later`,
                  );
                }

                return !isRateLimited;
              },
              5000,
              (rateSeconds * 1000) / 1.5, // 1.5 is the backoff factor of retryUntilTrue
            );

            const result = await this.handleBrokerFetchRequest({
              lookupKey,
              url,
              rateSeconds,
              saveToObjectStorage,
              headers,
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
              });
            }
          } catch (err) {
            if (err instanceof RetryException) {
              logger.error(
                `Error while retrying due to host rate limits: ${err.message}`,
                {
                  event: message,
                  err: (err as Error).stack,
                },
              );
            } else {
              logger.error(`Error processing fetch request message`, {
                event: message,
                err: (err as Error).stack,
              });
            }
          } finally {
            if (batchRequest.timestamp) {
              const nowTs = Date.now();
              const finishedTs = nowTs - batchRequest.timestamp;

              logger.datadog(
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

            await this.cacheStorageService.del(
              this.calculateCurrentlyProcessingCacheKeyForMessage(message),
            );
          }
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

      await Promise.all([
        this.partitionedRequestsStoreService.flushInserts(
          requestInsertsToFlush,
        ),
        this.em.flush(),
      ]);

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
  }

  private async handleBrokerFetchRequest(data: {
    lookupKey?: string;
    url: string;
    rateSeconds: number;
    saveToObjectStorage?: boolean;
    headers?: Record<string, string>;
  }): Promise<{
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
      });

    if (skip) {
      logger.debug(
        `Request ${url} with rate ${rateSeconds} has ` +
          `recently failed and will be skipped until ${nextRetryDate}`,
      );

      return { emitFetchCompleted: false };
    }

    const { isCacheStillActive, latestOkRequest } =
      await this.isLatestResponseStillFreshInCache({
        lookupKey: lookupKey || url,
      });

    if (isCacheStillActive) {
      logger.debug(
        `Request with lookup key ${
          lookupKey || url
        } still has active cache-control, skipping`,
      );

      return { emitFetchCompleted: false };
    }

    if (data.saveToObjectStorage) {
      logger.info(
        `DEBUG: About to fetch and response for ${url} for refresh rate ${data.rateSeconds}s`,
      );
    }

    const { request } = await this.feedFetcherService.fetchAndSaveResponse(
      url,
      {
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
      },
    );

    if (request.status === RequestStatus.REFUSED_LARGE_FEED) {
      this.emitRejectedUrl({ url, lookupKey });
    } else if (request.status !== RequestStatus.OK) {
      const nextRetryDate = this.calculateNextRetryDate(
        new Date(),
        failedAttemptsCount,
      );

      this.emitFailingUrl({ lookupKey, url });

      logger.debug(
        `Request with url ${url} failed, next retry date: ${nextRetryDate}`,
      );

      request.nextRetryDate = nextRetryDate;
    }

    return {
      request,
      emitFetchCompleted: request.status === RequestStatus.OK,
    };
  }

  async shouldSkipAfterPreviousFailedAttempt({
    lookupKey,
    url,
  }: {
    lookupKey?: string;
    url: string;
  }): Promise<{
    skip: boolean;
    failedAttemptsCount: number;
    nextRetryDate?: Date | null;
  }> {
    const failedAttempts = await this.countFailedRequests({
      lookupKey: lookupKey || url,
      url,
    });

    if (failedAttempts === 0) {
      return {
        skip: false,
        failedAttemptsCount: 0,
      };
    }

    if (failedAttempts >= this.maxFailAttempts) {
      this.emitFailedUrl({ lookupKey, url });

      return {
        skip: true,
        failedAttemptsCount: failedAttempts,
      };
    }

    const latestNextRetryDate =
      await this.partitionedRequestsStoreService.getLatestNextRetryDate(
        lookupKey || url,
      );

    if (!latestNextRetryDate) {
      logger.error(
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
  }

  emitRejectedUrl({
    url,
    lookupKey,
  }: {
    url: string;
    lookupKey: string | undefined;
  }) {
    try {
      logger.info(
        `Emitting rejected url for feeds with url "${url}", lookupkey ${lookupKey} `,
        {
          url,
          lookupKey,
        },
      );

      this.amqpConnection.publish<{
        data: { url: string; lookupKey?: string; status: RequestStatus };
      }>('', 'url.rejected.disable-feeds', {
        data: {
          url,
          status: RequestStatus.REFUSED_LARGE_FEED,
          lookupKey,
        },
      });
    } catch (err) {
      logger.error(`Failed to publish rejected url event: ${url}`, {
        stack: (err as Error).stack,
        url,
      });
    }
  }

  emitFailedUrl({ lookupKey, url }: { lookupKey?: string; url: string }) {
    try {
      logger.info(
        `Disabling feeds with lookup key "${lookupKey}" and url ${url} due to failure threshold `,
      );

      this.amqpConnection.publish<{
        data: { lookupKey?: string; url: string };
      }>('', 'url.failed.disable-feeds', {
        data: {
          lookupKey,
          url,
        },
      });
    } catch (err) {
      logger.error(`Failed to publish failed url event: ${lookupKey}`, {
        stack: (err as Error).stack,
        lookupKey,
      });
    }
  }

  emitFailingUrl({ lookupKey, url }: { lookupKey?: string; url: string }) {
    try {
      this.amqpConnection.publish<{
        data: { lookupKey?: string; url: string };
      }>('', 'url.failing', {
        data: {
          lookupKey,
          url,
        },
      });
    } catch (err) {
      logger.error(`Failed to publish failing lookup key event`, {
        stack: (err as Error).stack,
        lookupKey,
      });
    }
  }

  emitFetchCompleted({
    lookupKey,
    url,
    rateSeconds,
    debug,
  }: {
    lookupKey?: string;
    url: string;
    rateSeconds: number;
    debug?: boolean;
  }) {
    try {
      logger.debug(
        `Emitting fetch completed event for feeds with url "${url}", lookupkey ${lookupKey} `,
        {
          url,
          lookupKey,
        },
      );
      this.amqpConnection.publish<{
        data: {
          lookupKey?: string;
          url: string;
          rateSeconds: number;
          debug?: boolean;
        };
      }>('', 'url.fetch.completed', {
        data: {
          lookupKey,
          url,
          rateSeconds,
          debug,
        },
      });
    } catch (err) {
      logger.error(`Failed to publish fetch completed event: ${lookupKey}`, {
        stack: (err as Error).stack,
        lookupKey,
      });
    }
  }

  async isLatestResponseStillFreshInCache({
    lookupKey,
  }: {
    lookupKey: string;
  }): Promise<{
    isCacheStillActive: boolean;
    latestOkRequest?: Awaited<
      ReturnType<
        typeof FeedFetcherListenerService.prototype.partitionedRequestsStoreService.getLatestRequestWithOkStatus
      >
    >;
  }> {
    const latestOkRequest =
      await this.partitionedRequestsStoreService.getLatestRequestWithOkStatus(
        lookupKey,
        {
          fields: ['response_headers'],
        },
      );

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
    };
  }

  async countFailedRequests({
    lookupKey,
    url,
  }: {
    lookupKey?: string;
    url: string;
  }): Promise<number> {
    const latestOkRequest =
      await this.partitionedRequestsStoreService.getLatestRequestWithOkStatus(
        lookupKey || url,
        {},
      );

    return this.partitionedRequestsStoreService.countFailedRequests(
      lookupKey || url,
      latestOkRequest?.createdAt,
    );
  }

  calculateNextRetryDate(referenceDate: Date, attemptsSoFar: number) {
    const minutesToWait =
      FeedFetcherListenerService.BASE_FAILED_ATTEMPT_WAIT_MINUTES *
      Math.pow(2, attemptsSoFar);

    return dayjs(referenceDate).add(minutesToWait, 'minute').toDate();
  }
}

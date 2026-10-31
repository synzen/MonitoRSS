/* eslint-disable max-len */
import logger from '../utils/logger';
import contextLogger from '../shared/utils/log-context';
import type { FeedFetcherService } from '../feed-fetcher/feed-fetcher';
import {
  createScheduledFetchProcessor,
  type ScheduledFetchEvent,
} from '../feed-fetcher/scheduled-fetch';
import type { PartitionedRequestsStore } from '../stores/postgres/partitioned-requests-store';
import type { HostRateLimiterService } from '../host-rate-limiter/host-rate-limiter';
import type { CacheStorageService } from '../cache-storage/cache-storage';
import type { Publish } from './rabbitmq';
import {
  UrlFetchBatchSchema,
  UrlFetchCompletedSchema,
  UrlFailingSchema,
  UrlRejectedDisableFeedsSchema,
  UrlFailedDisableFeedsSchema,
  MessageBrokerQueue,
  type UrlFetchBatchPayload,
} from '@monitorss/contracts';

type BatchRequestMessage = UrlFetchBatchPayload;

export interface FeedFetcherListener {
  onBrokerFetchRequestBatch(message: BatchRequestMessage): Promise<void>;
  onBrokerFetchRequestBatchHandler(
    batchRequest: BatchRequestMessage,
  ): Promise<void>;
  emitFailedUrl(params: {
    lookupKey?: string;
    url: string;
    recovery?: { startedAt: number };
  }): void;
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
  // Every queue event shares the validate-then-publish shape: the contract
  // schema is the validator (ADR-007), and a validation failure or publish
  // rejection is only logged — it never interrupts batch processing.
  const publishValidated = (params: {
    queue: MessageBrokerQueue;
    // Structurally typed because Zod schema generics don't survive the
    // version skew between contracts' and this service's zod installs.
    schema: { parse: (input: unknown) => unknown };
    event: unknown;
    onError: (stack: string | undefined) => void;
  }): void => {
    try {
      params.schema.parse(params.event);

      void publish(params.queue, params.event).catch((err) => {
        params.onError((err as Error).stack);
      });
    } catch (err) {
      params.onError((err as Error).stack);
    }
  };

  // Maps a domain event emitted by the scheduled-fetch flow to its broker
  // queue, logging the publication the same way the pre-migration listener did.
  const publishEvent = (event: ScheduledFetchEvent) => {
    switch (event.kind) {
      case 'url-rejected':
        contextLogger.info(
          `Emitting rejected url for feeds with url "${event.data.url}", lookupkey ${event.data.lookupKey} `,
          {
            url: event.data.url,
            lookupKey: event.data.lookupKey,
          },
        );

        publishValidated({
          queue: MessageBrokerQueue.UrlRejectedDisableFeeds,
          schema: UrlRejectedDisableFeedsSchema,
          event: { data: event.data },
          onError: (stack) =>
            contextLogger.error(
              `Failed to publish rejected url event: ${event.data.url}`,
              {
                stack,
                url: event.data.url,
              },
            ),
        });

        break;

      case 'url-failed':
        contextLogger.info(
          `Disabling feeds with lookup key "${event.data.lookupKey}" and url ${event.data.url} due to failure threshold `,
        );

        publishValidated({
          queue: MessageBrokerQueue.UrlFailedDisableFeeds,
          schema: UrlFailedDisableFeedsSchema,
          event: { data: event.data },
          onError: (stack) =>
            contextLogger.error(
              `Failed to publish failed url event: ${event.data.lookupKey}`,
              {
                stack,
                lookupKey: event.data.lookupKey,
              },
            ),
        });

        break;

      case 'url-failing':
        publishValidated({
          queue: MessageBrokerQueue.UrlFailing,
          schema: UrlFailingSchema,
          event: { data: event.data },
          onError: (stack) =>
            contextLogger.error(`Failed to publish failing lookup key event`, {
              stack,
              lookupKey: event.data.lookupKey,
            }),
        });

        break;

      case 'fetch-completed':
        if (event.data.debug) {
          contextLogger.info(
            `Publishing url.fetch.completed event for feeds with url "${event.data.url}", lookupkey ${event.data.lookupKey}`,
            {
              url: event.data.url,
              lookupKey: event.data.lookupKey,
              rateSeconds: event.data.rateSeconds,
            },
          );
        }

        publishValidated({
          queue: MessageBrokerQueue.UrlFetchCompleted,
          schema: UrlFetchCompletedSchema,
          event: { data: event.data },
          onError: (stack) =>
            contextLogger.error(
              `Failed to publish fetch completed event: ${event.data.lookupKey}`,
              {
                stack,
                lookupKey: event.data.lookupKey,
              },
            ),
        });

        break;
    }
  };

  const processor = createScheduledFetchProcessor({
    maxFailAttempts,
    feedFetcher,
    partitionedRequestsStore,
    hostRateLimiter,
    cacheStorage,
    onEvent: publishEvent,
  });

  return {
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

      logger.debug(`Fetch batch request message received for batch urls`, {
        event: batchRequest,
      });

      try {
        await processor.processBatch(validatedBatch);
      } catch (err) {
        logger.error(`Error processing fetch batch request message`, {
          event: batchRequest,
          err: (err as Error).stack,
        });
      }
    },

    emitFailedUrl(params) {
      publishEvent({
        kind: 'url-failed',
        data: {
          lookupKey: params.lookupKey,
          url: params.url,
          recovery: params.recovery,
        },
      });
    },
  };
}

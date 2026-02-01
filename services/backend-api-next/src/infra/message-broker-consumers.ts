import type { Connection, Consumer } from "rabbitmq-client";
import { createConsumer, MessageBrokerQueue } from "./rabbitmq";
import type { MessageBrokerEventsService } from "../services/message-broker-events/message-broker-events.service";
import logger from "./logger";

export function registerMessageBrokerConsumers(
  connection: Connection,
  service: MessageBrokerEventsService,
): Consumer[] {
  const createQueueConsumer = createConsumer(connection);
  const consumers: Consumer[] = [];

  logger.info("Registering message broker consumers...");

  consumers.push(
    createQueueConsumer(
      MessageBrokerQueue.SyncSupporterDiscordRoles,
      async (msg) => {
        await service.handleSyncSupporterDiscordRoles(
          msg as { data: { userId: string } },
        );
      },
    ),
  );

  consumers.push(
    createQueueConsumer(MessageBrokerQueue.UrlFailing, async (msg) => {
      await service.handleUrlFailing(
        msg as { data: { lookupKey?: string; url: string } },
      );
    }),
  );

  consumers.push(
    createQueueConsumer(MessageBrokerQueue.UrlFetchCompleted, async (msg) => {
      await service.handleUrlFetchCompletedEvent(
        msg as {
          data: {
            url: string;
            lookupKey?: string;
            rateSeconds: number;
            debug?: boolean;
          };
        },
      );
    }),
  );

  consumers.push(
    createQueueConsumer(
      MessageBrokerQueue.UrlRejectedDisableFeeds,
      async (msg) => {
        await service.handleUrlRejectedDisableFeedsEvent(msg as any);
      },
    ),
  );

  consumers.push(
    createQueueConsumer(
      MessageBrokerQueue.UrlFailedDisableFeeds,
      async (msg) => {
        await service.handleUrlRequestFailureEvent(
          msg as { data: { url: string; lookupKey?: string } },
        );
      },
    ),
  );

  consumers.push(
    createQueueConsumer(
      MessageBrokerQueue.FeedRejectedDisableFeed,
      async (msg) => {
        await service.handleFeedRejectedDisableFeed(msg as any);
      },
    ),
  );

  consumers.push(
    createQueueConsumer(
      MessageBrokerQueue.FeedRejectedArticleDisableConnection,
      async (msg) => {
        await service.handleRejectedArticleDisableConnection(msg as any);
      },
    ),
  );

  logger.info(
    `Registered ${consumers.length} message broker consumers for queues: ` +
      `${MessageBrokerQueue.SyncSupporterDiscordRoles}, ` +
      `${MessageBrokerQueue.UrlFailing}, ` +
      `${MessageBrokerQueue.UrlFetchCompleted}, ` +
      `${MessageBrokerQueue.UrlRejectedDisableFeeds}, ` +
      `${MessageBrokerQueue.UrlFailedDisableFeeds}, ` +
      `${MessageBrokerQueue.FeedRejectedDisableFeed}, ` +
      `${MessageBrokerQueue.FeedRejectedArticleDisableConnection}`,
  );

  return consumers;
}

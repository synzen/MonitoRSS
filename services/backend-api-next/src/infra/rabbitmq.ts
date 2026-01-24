import { Connection } from "rabbitmq-client";
import logger from "./logger";

export enum MessageBrokerQueue {
  UrlFetchCompleted = "url.fetch.completed",
  UrlFetchBatch = "url.fetch-batch",
  UrlFailing = "url.failing",
  UrlFailedDisableFeeds = "url.failed.disable-feeds",
  UrlRejectedDisableFeeds = "url.rejected.disable-feeds",
  FeedRejectedArticleDisableConnection = "feed.rejected-article.disable-connection",
  FeedDeliverArticles = "feed.deliver-articles",
  FeedDeleted = "feed.deleted",
  FeedRejectedDisableFeed = "feed.rejected.disable-feed",
  SyncSupporterDiscordRoles = "sync-supporter-discord-roles",
}

export async function createRabbitConnection(url: string): Promise<Connection> {
  const connection = new Connection(encodeURI(url));

  connection.on("error", (err) => {
    logger.error("RabbitMQ connection error", { error: (err as Error).stack });
  });

  connection.on("connection", () => {
    logger.info("RabbitMQ connection established");
  });

  return connection;
}

export async function closeRabbitConnection(
  connection: Connection
): Promise<void> {
  try {
    await connection.close();
    logger.info("RabbitMQ connection closed");
  } catch (err) {
    logger.error("Failed to close RabbitMQ connection", {
      error: (err as Error).stack,
    });
  }
}

export function createPublisher(connection: Connection) {
  return async (queue: string, message: unknown): Promise<void> => {
    const pub = connection.createPublisher({
      confirm: true,
      maxAttempts: 3,
    });
    await pub.send(queue, message);
    await pub.close();
  };
}

function parseMessageBody(body: Buffer | string | unknown): unknown {
  if (Buffer.isBuffer(body)) {
    return JSON.parse(body.toString());
  }
  if (typeof body === "string") {
    return JSON.parse(body);
  }
  return body;
}

export function createConsumer(connection: Connection) {
  return (queue: string, handler: (msg: unknown) => Promise<void>) => {
    return connection.createConsumer(
      {
        queue,
        queueOptions: { durable: true },
        qos: { prefetchCount: 100 },
      },
      async (msg) => {
        try {
          await handler(parseMessageBody(msg.body));
        } catch (err) {
          logger.error(`Error handling message from ${queue}`, {
            error: (err as Error).stack,
          });
        }
      }
    );
  };
}

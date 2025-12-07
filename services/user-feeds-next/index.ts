import { config } from "dotenv";
import { Connection } from "rabbitmq-client";
import { SQL } from "bun";
import { logger } from "./src/utils";
import {
  parseFeedV2Event,
  handleFeedV2Event,
  handleArticleDeliveryResult,
  parseFeedDeletedEvent,
  handleFeedDeletedEvent,
  inMemoryResponseHashStore,
  type ResponseHashStore,
} from "./src/feed-event-handler";
import { MessageBrokerQueue } from "./src/constants";
import {
  createSynzenDiscordRestClient,
  type DiscordDeliveryResult,
  type DiscordRestClient,
} from "./src/delivery";
import {
  initializeRedisClient,
  closeRedisClient,
  createRedisParsedArticlesCacheStore,
  createRedisProcessingLock,
  inMemoryProcessingLock,
  type ProcessingLock,
} from "./src/redis";
import {
  inMemoryParsedArticlesCacheStore,
  type ParsedArticlesCacheStore,
} from "./src/parsed-articles-cache";
import {
  inMemoryArticleFieldStore,
  type ArticleFieldStore,
} from "./src/article-comparison";
import {
  inMemoryDeliveryRecordStore,
  type DeliveryRecordStore,
} from "./src/delivery-record-store";
import {
  inMemoryFeedRetryStore,
  type FeedRetryStore,
} from "./src/feed-retry-store";
import {
  createPostgresDeliveryRecordStore,
  createPostgresArticleFieldStore,
  createPostgresResponseHashStore,
  createPostgresFeedRetryStore,
  ensurePartitionsExist,
  pruneOldPartitions,
} from "./src/postgres";
import { createHttpServer } from "./src/http";

// Load environment variables
config();

/**
 * Parse RabbitMQ message body, handling Buffer/string when contentType isn't set.
 * The publisher (@golevelup/nestjs-rabbitmq) may not set contentType: application/json,
 * so rabbitmq-client may not auto-parse the JSON body.
 */
function parseMessageBody<T>(body: unknown): T {
  if (Buffer.isBuffer(body)) {
    return JSON.parse(body.toString()) as T;
  }
  return body as T;
}

const RABBITMQ_URL =
  process.env.USER_FEEDS_RABBITMQ_BROKER_URL ||
  "amqp://guest:guest@rabbitmq-broker:5672";
const DISCORD_CLIENT_ID = process.env.USER_FEEDS_DISCORD_CLIENT_ID || "";
const DISCORD_BOT_TOKEN = process.env.USER_FEEDS_DISCORD_API_TOKEN || "";
const REDIS_URI = process.env.USER_FEEDS_REDIS_URI;
const REDIS_DISABLE_CLUSTER =
  process.env.USER_FEEDS_REDIS_DISABLE_CLUSTER === "true";
const POSTGRES_URI = process.env.USER_FEEDS_POSTGRES_URI;
const HTTP_PORT = parseInt(process.env.USER_FEEDS_API_PORT || "5000", 10);
const ARTICLE_PERSISTENCE_MONTHS = parseInt(
  process.env.USER_FEEDS_ARTICLE_PERSISTENCE_MONTHS || "12",
  10
);
const DELIVERY_RECORD_PERSISTENCE_MONTHS = parseInt(
  process.env.USER_FEEDS_DELIVERY_RECORD_PERSISTENCE_MONTHS || "2",
  10
);
const PREFETCH_COUNT = parseInt(
  process.env.USER_FEEDS_PREFETCH_COUNT || "100",
  10
);
const PARTITION_MANAGEMENT_INTERVAL_MS = 60000 * 24; // 24 minutes (matches user-feeds)
const START_TARGET = process.env.USER_FEEDS_START_TARGET; // "service" | "api" | undefined

// Global SQL client for shutdown
let sqlClient: SQL | null = null;

interface SharedInfrastructure {
  deliveryRecordStore: DeliveryRecordStore;
  articleFieldStore: ArticleFieldStore;
  responseHashStore: ResponseHashStore;
  feedRetryStore: FeedRetryStore;
  parsedArticlesCacheStore: ParsedArticlesCacheStore;
  processingLock: ProcessingLock;
  discordClient: DiscordRestClient & { initialize(): Promise<void>; close(): void } | null;
}

/**
 * Initialize shared infrastructure (Redis, PostgreSQL, stores) used by all modes.
 */
async function initializeSharedInfrastructure(): Promise<SharedInfrastructure> {
  // Initialize Redis if configured, otherwise fall back to in-memory stores
  let parsedArticlesCacheStore: ParsedArticlesCacheStore =
    inMemoryParsedArticlesCacheStore;
  let processingLock: ProcessingLock = inMemoryProcessingLock;

  if (REDIS_URI) {
    const redisClient = await initializeRedisClient({
      uri: REDIS_URI,
      disableCluster: REDIS_DISABLE_CLUSTER,
    });
    parsedArticlesCacheStore = createRedisParsedArticlesCacheStore(redisClient);
    processingLock = createRedisProcessingLock(redisClient);
    logger.info("Using Redis-backed cache store and processing lock");
  } else {
    logger.info("No Redis URI configured, using in-memory stores");
  }

  // Initialize PostgreSQL stores if configured, otherwise fall back to in-memory
  let deliveryRecordStore: DeliveryRecordStore = inMemoryDeliveryRecordStore;
  let articleFieldStore: ArticleFieldStore = inMemoryArticleFieldStore;
  let responseHashStore: ResponseHashStore = inMemoryResponseHashStore;
  let feedRetryStore: FeedRetryStore = inMemoryFeedRetryStore;

  if (POSTGRES_URI) {
    sqlClient = new SQL(POSTGRES_URI);
    logger.info("Successfully connected to PostgreSQL");

    deliveryRecordStore = createPostgresDeliveryRecordStore(sqlClient);
    articleFieldStore = createPostgresArticleFieldStore(sqlClient);
    responseHashStore = createPostgresResponseHashStore(sqlClient);
    feedRetryStore = createPostgresFeedRetryStore(sqlClient);
    logger.info("Using PostgreSQL-backed stores");

    // Run partition management on startup
    await ensurePartitionsExist(sqlClient);
    await pruneOldPartitions(sqlClient, {
      articlePersistenceMonths: ARTICLE_PERSISTENCE_MONTHS,
      deliveryRecordPersistenceMonths: DELIVERY_RECORD_PERSISTENCE_MONTHS,
    });

    // Schedule recurring partition management
    setInterval(async () => {
      logger.info("Running recurring task to prune and create partitions...");
      try {
        await ensurePartitionsExist(sqlClient!);
        await pruneOldPartitions(sqlClient!, {
          articlePersistenceMonths: ARTICLE_PERSISTENCE_MONTHS,
          deliveryRecordPersistenceMonths: DELIVERY_RECORD_PERSISTENCE_MONTHS,
        });
        logger.info(
          "Recurring task to prune and create partitions ran successfully"
        );
      } catch (err) {
        logger.error(
          "Failed to run recurring task to prune and create partitions",
          {
            error: (err as Error).stack,
          }
        );
      }
    }, PARTITION_MANAGEMENT_INTERVAL_MS);
  } else {
    logger.info("No PostgreSQL URI configured, using in-memory stores");
  }

  // Create Discord REST client if credentials are available
  let discordClient: SharedInfrastructure["discordClient"] = null;
  if (DISCORD_CLIENT_ID && DISCORD_BOT_TOKEN) {
    discordClient = createSynzenDiscordRestClient({
      rabbitmqUri: RABBITMQ_URL,
      clientId: DISCORD_CLIENT_ID,
      botToken: DISCORD_BOT_TOKEN,
    });
  }

  return {
    deliveryRecordStore,
    articleFieldStore,
    responseHashStore,
    feedRetryStore,
    parsedArticlesCacheStore,
    processingLock,
    discordClient,
  };
}

/**
 * Close shared infrastructure (Redis, PostgreSQL).
 */
async function closeSharedInfrastructure(): Promise<void> {
  await closeRedisClient();

  if (sqlClient) {
    try {
      await sqlClient.close();
      logger.info("Successfully closed PostgreSQL connection");
    } catch (err) {
      logger.error("Failed to close PostgreSQL connection", {
        error: (err as Error).stack,
      });
    }
  }
}

/**
 * Start API mode (HTTP server only).
 * Returns a cleanup function.
 */
async function startApiMode(
  infrastructure: SharedInfrastructure
): Promise<() => Promise<void>> {
  // Initialize Discord client for test endpoint
  if (!infrastructure.discordClient) {
    throw new Error(
      "Discord client is required for API mode (test endpoint). Check DISCORD_CLIENT_ID and DISCORD_API_TOKEN."
    );
  }
  await infrastructure.discordClient.initialize();

  const httpServer = createHttpServer(
    {
      deliveryRecordStore: infrastructure.deliveryRecordStore,
      discordClient: infrastructure.discordClient,
    },
    HTTP_PORT
  );

  logger.info(`HTTP server listening on port ${HTTP_PORT}`);

  return async () => {
    httpServer.stop();
    logger.info("HTTP server stopped");
    infrastructure.discordClient?.close();
  };
}

/**
 * Start service mode (RabbitMQ consumers only).
 * Returns a cleanup function.
 */
async function startServiceMode(
  infrastructure: SharedInfrastructure
): Promise<() => Promise<void>> {
  // Validate Discord client is available
  if (!infrastructure.discordClient) {
    throw new Error(
      "Discord client is required for service mode. Check USER_FEEDS_DISCORD_CLIENT_ID and USER_FEEDS_DISCORD_API_TOKEN."
    );
  }

  // Initialize Discord REST client
  await infrastructure.discordClient.initialize();

  logger.info("Connecting to RabbitMQ...");

  // Create RabbitMQ connection
  const connection = new Connection(RABBITMQ_URL);

  connection.on("error", (err) => {
    logger.error("RabbitMQ connection error", { error: (err as Error).stack });
  });

  logger.info("RabbitMQ connection initiated");

  // Create a publisher function for sending messages to queues
  const publisher = async (queue: string, message: unknown): Promise<void> => {
    const pub = connection.createPublisher({
      confirm: true,
      maxAttempts: 3,
    });
    await pub.send(queue, message);
    await pub.close();
  };

  // Create feed event consumer
  const feedEventConsumer = connection.createConsumer(
    {
      queue: MessageBrokerQueue.FeedDeliverArticles,
      queueOptions: { durable: true },
      qos: { prefetchCount: PREFETCH_COUNT },
    },
    async (msg) => {
      const body = parseMessageBody(msg.body);
      const event = parseFeedV2Event(body);

      if (!event) {
        logger.error("Failed to parse message, skipping");
        return;
      }

      const feedId = event.data.feed.id;

      // Acquire processing lock to prevent concurrent processing of same feed
      const lockAcquired = await infrastructure.processingLock.acquire(feedId);
      if (!lockAcquired) {
        logger.debug(
          `User feed event for feed ${feedId} is already being processed, ignoring`
        );
        return;
      }

      try {
        await handleFeedV2Event(event, {
          parsedArticlesCacheStore: infrastructure.parsedArticlesCacheStore,
          articleFieldStore: infrastructure.articleFieldStore,
          deliveryRecordStore: infrastructure.deliveryRecordStore,
          responseHashStore: infrastructure.responseHashStore,
          feedRetryStore: infrastructure.feedRetryStore,
          discordClient: infrastructure.discordClient!,
        });
      } finally {
        await infrastructure.processingLock.release(feedId);
      }
    }
  );

  feedEventConsumer.on("error", (err) => {
    logger.error("Feed event consumer error", { error: (err as Error).stack });
  });

  logger.debug(
    `Feed event consumer created with prefetch count: ${PREFETCH_COUNT}`
  );

  // Create delivery result consumer
  const deliveryResultConsumer = connection.createConsumer(
    {
      queue: MessageBrokerQueue.FeedArticleDeliveryResult,
      queueOptions: { durable: true },
      qos: { prefetchCount: PREFETCH_COUNT },
    },
    async (msg) => {
      const deliveryResult = parseMessageBody<DiscordDeliveryResult>(msg.body);

      if (!deliveryResult?.job || !deliveryResult?.result) {
        logger.error("Invalid delivery result message, skipping", {
          hasJob: !!deliveryResult?.job,
          hasResult: !!deliveryResult?.result,
        });
        return;
      }

      try {
        await handleArticleDeliveryResult(deliveryResult, publisher);
      } catch (err) {
        logger.warn("Failed to handle article delivery result", {
          error: (err as Error).stack,
          result: deliveryResult,
        });
      }
    }
  );

  deliveryResultConsumer.on("error", (err) => {
    logger.error("Delivery result consumer error", {
      error: (err as Error).stack,
    });
  });

  logger.debug(
    `Delivery result consumer created with prefetch count: ${PREFETCH_COUNT}`
  );

  // Create feed deleted consumer
  const feedDeletedConsumer = connection.createConsumer(
    {
      queue: MessageBrokerQueue.FeedDeleted,
      queueOptions: { durable: true },
      qos: { prefetchCount: PREFETCH_COUNT },
    },
    async (msg) => {
      const body = parseMessageBody(msg.body);
      const event = parseFeedDeletedEvent(body);

      if (!event) {
        logger.error("Failed to parse feed deleted message, skipping");
        return;
      }

      try {
        await handleFeedDeletedEvent(event, {
          responseHashStore: infrastructure.responseHashStore,
          articleFieldStore: infrastructure.articleFieldStore,
          feedRetryStore: infrastructure.feedRetryStore,
        });
      } catch (err) {
        logger.error("Failed to handle feed deleted event", {
          event,
          error: (err as Error).stack,
        });
      }
    }
  );

  feedDeletedConsumer.on("error", (err) => {
    logger.error("Feed deleted consumer error", {
      error: (err as Error).stack,
    });
  });

  logger.debug(
    `Feed deleted consumer created with prefetch count: ${PREFETCH_COUNT}`
  );

  return async () => {
    await feedEventConsumer.close();
    await deliveryResultConsumer.close();
    await feedDeletedConsumer.close();

    try {
      await connection.close();
      logger.info("Successfully closed AMQP connection");
    } catch (err) {
      logger.error("Failed to close AMQP connection", {
        error: (err as Error).stack,
      });
    }

    infrastructure.discordClient?.close();
  };
}

async function main() {
  const infrastructure = await initializeSharedInfrastructure();

  let cleanup: () => Promise<void>;

  if (START_TARGET === "api") {
    logger.info("Starting in API mode (HTTP server only)");
    cleanup = await startApiMode(infrastructure);
  } else if (START_TARGET === "service") {
    logger.info("Starting in SERVICE mode (RabbitMQ consumers only)");
    cleanup = await startServiceMode(infrastructure);
  } else {
    logger.info("Starting in FULL mode (HTTP server + RabbitMQ consumers)");
    const apiCleanup = await startApiMode(infrastructure);
    const serviceCleanup = await startServiceMode(infrastructure);
    cleanup = async () => {
      await apiCleanup();
      await serviceCleanup();
    };
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received signal ${signal}. Shutting down...`);
    await cleanup();
    await closeSharedInfrastructure();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error("Failed to start service", { error: (err as Error).stack });
  process.exit(1);
});

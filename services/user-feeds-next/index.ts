import { config } from "dotenv";
import { Connection } from "rabbitmq-client";
import { logger } from "./src/shared/utils";
import {
  parseFeedV2Event,
  handleFeedV2Event,
  handleArticleDeliveryResult,
  parseFeedDeletedEvent,
  handleFeedDeletedEvent,
  inMemoryResponseHashStore,
  type ResponseHashStore,
} from "./src/feeds/feed-event-handler";
import { MessageBrokerQueue } from "./src/shared/constants";
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
} from "./src/stores/redis";
import { inMemoryParsedArticlesCacheStore } from "./src/stores/in-memory/parsed-articles-cache";
import type { ParsedArticlesCacheStore } from "./src/stores/interfaces/parsed-articles-cache";
import {
  inMemoryArticleFieldStore,
  type ArticleFieldStore,
} from "./src/articles/comparison";
import { inMemoryDeliveryRecordStore } from "./src/stores/in-memory/delivery-record-store";
import type { DeliveryRecordStore } from "./src/stores/interfaces/delivery-record-store";
import { inMemoryFeedRetryStore } from "./src/stores/in-memory/feed-retry-store";
import type { FeedRetryStore } from "./src/stores/interfaces/feed-retry-store";
import type { Pool } from "pg";
import {
  initPool,
  closePool,
  createPostgresDeliveryRecordStore,
  createPostgresArticleFieldStore,
  createPostgresResponseHashStore,
  createPostgresFeedRetryStore,
  ensurePartitionsExist,
  pruneOldPartitions,
} from "./src/stores/postgres";
import { createHttpServer } from "./src/http";
import { terminateFeedParserPool } from "./src/articles/parser/worker";

import "dayjs/locale/af";
import "dayjs/locale/am";
import "dayjs/locale/ar-dz";
import "dayjs/locale/ar-iq";
import "dayjs/locale/ar-kw";
import "dayjs/locale/ar-ly";
import "dayjs/locale/ar-ma";
import "dayjs/locale/ar-sa";
import "dayjs/locale/ar-tn";
import "dayjs/locale/ar";
import "dayjs/locale/az";
import "dayjs/locale/be";
import "dayjs/locale/bg";
import "dayjs/locale/bi";
import "dayjs/locale/bm";
import "dayjs/locale/bn-bd";
import "dayjs/locale/bn";
import "dayjs/locale/bo";
import "dayjs/locale/br";
import "dayjs/locale/bs";
import "dayjs/locale/ca";
import "dayjs/locale/cs";
import "dayjs/locale/cv";
import "dayjs/locale/cy";
import "dayjs/locale/da";
import "dayjs/locale/de-at";
import "dayjs/locale/de-ch";
import "dayjs/locale/de";
import "dayjs/locale/dv";
import "dayjs/locale/el";
import "dayjs/locale/en-au";
import "dayjs/locale/en-ca";
import "dayjs/locale/en-gb";
import "dayjs/locale/en-ie";
import "dayjs/locale/en-il";
import "dayjs/locale/en-in";
import "dayjs/locale/en-nz";
import "dayjs/locale/en-sg";
import "dayjs/locale/en-tt";
import "dayjs/locale/en";
import "dayjs/locale/eo";
import "dayjs/locale/es-do";
import "dayjs/locale/es-mx";
import "dayjs/locale/es-pr";
import "dayjs/locale/es-us";
import "dayjs/locale/es";
import "dayjs/locale/et";
import "dayjs/locale/eu";
import "dayjs/locale/fa";
import "dayjs/locale/fi";
import "dayjs/locale/fo";
import "dayjs/locale/fr-ca";
import "dayjs/locale/fr-ch";
import "dayjs/locale/fr";
import "dayjs/locale/fy";
import "dayjs/locale/ga";
import "dayjs/locale/gd";
import "dayjs/locale/gl";
import "dayjs/locale/gom-latn";
import "dayjs/locale/gu";
import "dayjs/locale/hi";
import "dayjs/locale/he";
import "dayjs/locale/hr";
import "dayjs/locale/ht";
import "dayjs/locale/hu";
import "dayjs/locale/hy-am";
import "dayjs/locale/id";
import "dayjs/locale/is";
import "dayjs/locale/it-ch";
import "dayjs/locale/it";
import "dayjs/locale/ja";
import "dayjs/locale/jv";
import "dayjs/locale/ka";
import "dayjs/locale/kk";
import "dayjs/locale/km";
import "dayjs/locale/kn";
import "dayjs/locale/ko";
import "dayjs/locale/ku";
import "dayjs/locale/ky";
import "dayjs/locale/lb";
import "dayjs/locale/lo";
import "dayjs/locale/lt";
import "dayjs/locale/lv";
import "dayjs/locale/me";
import "dayjs/locale/mi";
import "dayjs/locale/mk";
import "dayjs/locale/ml";
import "dayjs/locale/mn";
import "dayjs/locale/mr";
import "dayjs/locale/ms-my";
import "dayjs/locale/ms";
import "dayjs/locale/mt";
import "dayjs/locale/my";
import "dayjs/locale/nb";
import "dayjs/locale/ne";
import "dayjs/locale/nl-be";
import "dayjs/locale/nl";
import "dayjs/locale/nn";
import "dayjs/locale/oc-lnc";
import "dayjs/locale/pa-in";
import "dayjs/locale/pl";
import "dayjs/locale/pt-br";
import "dayjs/locale/pt";
import "dayjs/locale/rn";
import "dayjs/locale/ro";
import "dayjs/locale/sd";
import "dayjs/locale/si";
import "dayjs/locale/se";
import "dayjs/locale/sk";
import "dayjs/locale/sl";
import "dayjs/locale/sq";
import "dayjs/locale/sr-cyrl";
import "dayjs/locale/sr";
import "dayjs/locale/ss";
import "dayjs/locale/sv-fi";
import "dayjs/locale/sv";
import "dayjs/locale/sw";
import "dayjs/locale/ta";
import "dayjs/locale/te";
import "dayjs/locale/tg";
import "dayjs/locale/tet";
import "dayjs/locale/th";
import "dayjs/locale/tk";
import "dayjs/locale/tl-ph";
import "dayjs/locale/tlh";
import "dayjs/locale/tr";
import "dayjs/locale/tzl";
import "dayjs/locale/tzm-latn";
import "dayjs/locale/ug-cn";
import "dayjs/locale/tzm";
import "dayjs/locale/uk";
import "dayjs/locale/ur";
import "dayjs/locale/uz-latn";
import "dayjs/locale/vi";
import "dayjs/locale/uz";
import "dayjs/locale/yo";
import "dayjs/locale/x-pseudo";
import "dayjs/locale/zh-cn";
import "dayjs/locale/zh-hk";
import "dayjs/locale/zh-tw";
import "dayjs/locale/zh";
import "dayjs/locale/rw";
import "dayjs/locale/ru";

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

// Global pool for shutdown
let pool: Pool | null = null;

interface SharedInfrastructure {
  deliveryRecordStore: DeliveryRecordStore;
  articleFieldStore: ArticleFieldStore;
  responseHashStore: ResponseHashStore;
  feedRetryStore: FeedRetryStore;
  parsedArticlesCacheStore: ParsedArticlesCacheStore;
  processingLock: ProcessingLock;
  discordClient:
    | (DiscordRestClient & { initialize(): Promise<void>; close(): void })
    | null;
  feedRequestsServiceHost: string;
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
    pool = initPool(POSTGRES_URI);
    logger.info("Successfully connected to PostgreSQL");

    deliveryRecordStore = createPostgresDeliveryRecordStore(pool);
    articleFieldStore = createPostgresArticleFieldStore(pool);
    responseHashStore = createPostgresResponseHashStore(pool);
    feedRetryStore = createPostgresFeedRetryStore(pool);

    // Run partition management on startup
    await ensurePartitionsExist(pool);
    await pruneOldPartitions(pool, {
      articlePersistenceMonths: ARTICLE_PERSISTENCE_MONTHS,
      deliveryRecordPersistenceMonths: DELIVERY_RECORD_PERSISTENCE_MONTHS,
    });

    // Schedule recurring partition management
    setInterval(async () => {
      logger.info("Running recurring task to prune and create partitions...");
      try {
        await ensurePartitionsExist(pool!);
        await pruneOldPartitions(pool!, {
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

  const feedRequestsServiceHost = process.env.USER_FEEDS_FEED_REQUESTS_API_URL;

  if (!feedRequestsServiceHost) {
    throw new Error(
      "Feed Requests service host is required for API mode. Check USER_FEEDS_FEED_REQUESTS_API_URL."
    );
  }

  return {
    deliveryRecordStore,
    articleFieldStore,
    responseHashStore,
    feedRetryStore,
    parsedArticlesCacheStore,
    processingLock,
    discordClient,
    feedRequestsServiceHost,
  };
}

/**
 * Close shared infrastructure (Redis, PostgreSQL, worker pool).
 */
async function closeSharedInfrastructure(): Promise<void> {
  // Terminate worker pool
  await terminateFeedParserPool();

  await closeRedisClient();

  if (pool) {
    try {
      await closePool();
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
      feedRequestsServiceHost: infrastructure.feedRequestsServiceHost,
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
          feedRequestsServiceHost: infrastructure.feedRequestsServiceHost,
        });
      } catch (err) {
        logger.error("Failed to handle user feed event", {
          feedId,
          error: (err as Error).stack,
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
        await handleArticleDeliveryResult(
          deliveryResult,
          publisher,
          infrastructure.deliveryRecordStore
        );
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

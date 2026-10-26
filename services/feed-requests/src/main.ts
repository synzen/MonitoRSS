import { MessageBrokerQueue } from '@monitorss/contracts';
import { loadConfig } from './config';
import logger from './utils/logger';
import pruneAndCreatePartitions from './utils/prune-and-create-partitions';
import { initPool, closePool, getPool } from './stores/postgres';
import { createPartitionedRequestsStore } from './stores/postgres/partitioned-requests-store';
import {
  createCacheClient,
  createCacheStorageService,
} from './cache-storage/cache-storage';
import { createObjectFileStorageService } from './object-file-storage/object-file-storage';
import { createHostRateLimiterService } from './host-rate-limiter/host-rate-limiter';
import { createFeedFetcherService } from './feed-fetcher/feed-fetcher';
import { createApp } from './http/app';
import {
  createRabbitConnection,
  createPublisher,
  createQueueConsumer,
} from './consumers/rabbitmq';
import { createFeedFetcherListener } from './consumers/feed-fetcher-listener';

async function tryDbConnection(currentTries = 0) {
  if (currentTries >= 10) {
    // eslint-disable-next-line no-console -- Datadog mode disables logger console output
    console.error('Failed to connect to database after 10 tries. Exiting...');
    logger.error('Failed to connect to database after 10 tries. Exiting...');

    process.exit(1);
  }

  try {
    await getPool().query('SELECT 1');
  } catch (err) {
    logger.error('Failed to ping database', {
      error: (err as Error).stack,
    });

    return tryDbConnection(currentTries + 1);
  }
}

async function schedulePruneAndCreatePartitions(
  historyPersistenceMonths: number,
) {
  await pruneAndCreatePartitions(getPool(), historyPersistenceMonths);

  setInterval(() => {
    logger.info('Running recurring task to prune and create partitions...');
    pruneAndCreatePartitions(getPool(), historyPersistenceMonths)
      .then(() => {
        logger.info(
          'Recurring task to prune and create partitions ran successfully',
        );
      })
      .catch((err) => {
        // eslint-disable-next-line no-console -- Datadog mode disables logger console output
        console.error(err);
        logger.error(
          `Failed to run recurring task to prune and create partitions`,
        );
        process.exit(1);
      });
  }, 60000 * 24);
}

interface CoreInfrastructure {
  cacheStorage: ReturnType<typeof createCacheStorageService>;
  partitionedRequestsStore: ReturnType<typeof createPartitionedRequestsStore>;
  feedFetcher: ReturnType<typeof createFeedFetcherService>;
}

async function buildCoreInfrastructure(
  config: ReturnType<typeof loadConfig>,
): Promise<CoreInfrastructure> {
  const pool = initPool(config.FEED_REQUESTS_POSTGRES_URI, {
    max: config.FEED_REQUESTS_RABBITMQ_PREFETCH_COUNT * 3,
  });
  const cacheClient = await createCacheClient({
    uri: config.FEED_REQUESTS_REDIS_URI,
    disableCluster: config.FEED_REQUESTS_REDIS_DISABLE_CLUSTER,
  });
  const cacheStorage = createCacheStorageService(cacheClient);
  const objectFileStorage = createObjectFileStorageService({
    endpoint: config.FEED_REQUESTS_S3_ENDPOINT,
    keyId: config.FEED_REQUESTS_S3_API_KEY_ID,
    key: config.FEED_REQUESTS_S3_API_KEY,
  });
  const partitionedRequestsStore = createPartitionedRequestsStore(pool);
  const feedFetcher = createFeedFetcherService({
    defaultUserAgent: config.FEED_REQUESTS_FEED_REQUEST_DEFAULT_USER_AGENT,
    requestTimeoutMs: config.FEED_REQUESTS_REQUEST_TIMEOUT_MS,
    objectFileStorage,
    cacheStorage,
    partitionedRequestsStore,
  });

  return { cacheStorage, partitionedRequestsStore, feedFetcher };
}

async function startApi() {
  const config = loadConfig();
  const { cacheStorage, feedFetcher, partitionedRequestsStore } =
    await buildCoreInfrastructure(config);
  const hostRateLimiter = createHostRateLimiterService(cacheStorage);

  const app = createApp({
    apiKey: config.FEED_REQUESTS_API_KEY,
    feedFetcher,
    partitionedRequestsStore,
    hostRateLimiter,
  });

  await app.listen({
    port: config.FEED_REQUESTS_API_PORT,
    host: '0.0.0.0',
  });

  setInterval(() => {
    tryDbConnection().catch(() => process.exit(1));
  }, 60000);

  logger.info(`API is running on port ${config.FEED_REQUESTS_API_PORT}`);

  return {
    shutdown: async () => {
      await app.close();
      await cacheStorage.closeClient();
      await closePool();
    },
  };
}

async function startService() {
  const config = loadConfig();
  const { cacheStorage, feedFetcher, partitionedRequestsStore } =
    await buildCoreInfrastructure(config);
  const hostRateLimiter = createHostRateLimiterService(cacheStorage);

  const connection = createRabbitConnection(
    config.FEED_REQUESTS_RABBITMQ_BROKER_URL,
  );
  const publish = createPublisher(connection);
  const listener = createFeedFetcherListener({
    maxFailAttempts: config.FEED_REQUESTS_MAX_FAIL_ATTEMPTS,
    feedFetcher,
    partitionedRequestsStore,
    hostRateLimiter,
    cacheStorage,
    publish,
  });
  const consumer = createQueueConsumer(
    connection,
    {
      queue: MessageBrokerQueue.UrlFetchBatch,
      prefetchCount: config.FEED_REQUESTS_RABBITMQ_PREFETCH_COUNT,
    },
    async (message) => {
      await listener.onBrokerFetchRequestBatch(
        message as Parameters<typeof listener.onBrokerFetchRequestBatch>[0],
      );
    },
  );

  setInterval(() => {
    tryDbConnection().catch(() => process.exit(1));
  }, 60000);

  logger.info(`Service is running`);

  return {
    shutdown: async () => {
      await consumer.close();
      await connection.close();
      await cacheStorage.closeClient();
      await closePool();
    },
  };
}

async function bootstrap() {
  let api: Awaited<ReturnType<typeof startApi>> | undefined;
  let service: Awaited<ReturnType<typeof startService>> | undefined;

  const startTarget = process.env.FEED_REQUESTS_START_TARGET;

  if (startTarget === 'api') {
    api = await startApi();

    await schedulePruneAndCreatePartitions(
      loadConfig().FEED_REQUESTS_HISTORY_PERSISTENCE_MONTHS,
    );
  } else if (startTarget === 'service') {
    service = await startService();
  } else if (startTarget) {
    logger.error('Invalid FEED_REQUESTS_START_TARGET environment variable');

    process.exit(1);
  } else {
    api = await startApi();

    await schedulePruneAndCreatePartitions(
      loadConfig().FEED_REQUESTS_HISTORY_PERSISTENCE_MONTHS,
    );

    service = await startService();
  }

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down...`);

    try {
      await api?.shutdown();
    } catch (err) {
      logger.error('Error during API shutdown', {
        error: (err as Error).stack,
      });
    }

    try {
      await service?.shutdown();
    } catch (err) {
      logger.error('Error during service shutdown', {
        error: (err as Error).stack,
      });
    }

    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

void bootstrap();

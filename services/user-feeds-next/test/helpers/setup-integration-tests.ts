import { Client, Pool } from "pg";
import {
  createPostgresArticleFieldStore,
  createPostgresDeliveryRecordStore,
  createPostgresResponseHashStore,
  createPostgresFeedRetryStore,
  truncateAllTables,
} from "../../src/stores/postgres";
import {
  createRedisParsedArticlesCacheStore,
  createStandaloneRedisClient,
  type RedisClientType,
} from "../../src/stores/redis";
import type { ArticleFieldStore } from "../../src/articles/comparison";
import type { DeliveryRecordStore } from "../../src/stores/interfaces/delivery-record-store";
import type { ResponseHashStore } from "../../src/feeds/feed-event-handler";
import type { FeedRetryStore } from "../../src/stores/interfaces/feed-retry-store";
import type { ParsedArticlesCacheStore } from "../../src/stores/interfaces/parsed-articles-cache";
import {
  createTestDiscordRestClient,
  type DiscordRestClient,
} from "../../src/delivery/mediums/discord/discord-rest-client";
import {
  createTestFeedRequestsServer,
  type TestFeedRequestsServer,
} from "./test-feed-requests-server";
import { TEMPLATE_DB_NAME, getAdminUri, getTestDbUri } from "./test-constants";


// ============================================================================
// Types
// ============================================================================

export interface TestStores {
  pool: Pool;
  articleFieldStore: ArticleFieldStore;
  deliveryRecordStore: DeliveryRecordStore;
  responseHashStore: ResponseHashStore;
  feedRetryStore: FeedRetryStore;
  parsedArticlesCacheStore: ParsedArticlesCacheStore;
  discordClient: DiscordRestClient;
  feedRequestsServiceHost: string;
  truncate: () => Promise<void>;
}

// ============================================================================
// Per-File State (each test file gets its own module instance)
// ============================================================================

let testPool: Pool | null = null;
let testRedisClient: RedisClientType | null = null;
let testFeedRequestsServer: TestFeedRequestsServer | null = null;
let currentDatabaseName: string | null = null;

// ============================================================================
// Test Server Management
// ============================================================================

function getOrCreateTestServer(): TestFeedRequestsServer {
  if (!testFeedRequestsServer) {
    testFeedRequestsServer = createTestFeedRequestsServer();
  }
  return testFeedRequestsServer;
}

// ============================================================================
// Per-File Database Setup (for parallel test execution)
// ============================================================================

/**
 * Set up a unique database for the current test file.
 * Call this in the test file's before() hook.
 * Returns stores scoped to the new database.
 */
const REDIS_DB_COUNT = 64;

async function claimRedisDb(redisUri: string): Promise<number> {
  const coordinator = await createStandaloneRedisClient(redisUri, 0);
  try {
    const n = Number(await coordinator.incr("__test_db_counter__"));
    if (n > REDIS_DB_COUNT - 1) {
      throw new Error(
        `Exhausted Redis test DBs: claimed #${n} but only ${REDIS_DB_COUNT - 1} are available ` +
          `(DB 0 is reserved for the coordinator). Raise the 'databases' setting in ` +
          `docker-compose.test.yml's redis-server command to fit more parallel test files.`
      );
    }
    return n;
  } finally {
    await coordinator.disconnect();
  }
}

export async function setupTestDatabase(): Promise<TestStores> {
  currentDatabaseName = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const testServer = getOrCreateTestServer();

  const adminClient = new Client({ connectionString: getAdminUri() });
  await adminClient.connect();
  await adminClient.query(`CREATE DATABASE "${currentDatabaseName}" TEMPLATE ${TEMPLATE_DB_NAME}`);
  await adminClient.end();

  testPool = new Pool({ connectionString: getTestDbUri(currentDatabaseName), max: 10 });

  const redisUri = process.env.USER_FEEDS_REDIS_URI ?? "redis://localhost:6379";
  const redisDb = await claimRedisDb(redisUri);
  testRedisClient = await createStandaloneRedisClient(redisUri, redisDb);

  const pool = testPool;
  const redis = testRedisClient;

  return {
    pool,
    articleFieldStore: createPostgresArticleFieldStore(pool),
    deliveryRecordStore: createPostgresDeliveryRecordStore(pool),
    responseHashStore: createPostgresResponseHashStore(pool),
    feedRetryStore: createPostgresFeedRetryStore(pool),
    parsedArticlesCacheStore: createRedisParsedArticlesCacheStore(redis),
    discordClient: createTestDiscordRestClient(),
    feedRequestsServiceHost: `http://localhost:${testServer.port}`,
    async truncate() {
      await truncateAllTables(pool);
      await redis.flushDb();
    },
  };
}

/**
 * Tear down the database for the current test file.
 * Call this in the test file's after() hook.
 */
export async function teardownTestDatabase(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = null;
  }

  if (testRedisClient) {
    await testRedisClient.flushDb();
    await testRedisClient.disconnect();
    testRedisClient = null;
  }

  if (testFeedRequestsServer) {
    await testFeedRequestsServer.stop();
    testFeedRequestsServer = null;
  }

  if (currentDatabaseName) {
    const adminClient = new Client({ connectionString: getAdminUri() });
    await adminClient.connect();
    try {
      await adminClient.query(`DROP DATABASE IF EXISTS "${currentDatabaseName}"`);
    } finally {
      await adminClient.end();
    }
    currentDatabaseName = null;
  }
}

/**
 * Get the test feed-requests server.
 */
export function getTestFeedRequestsServer(): TestFeedRequestsServer {
  return getOrCreateTestServer();
}

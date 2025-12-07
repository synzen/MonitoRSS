import { SQL } from "bun";
import {
  initSqlClient,
  closeSqlClient,
  runMigrations,
  ensurePartitionsExist,
  truncateAllTables,
  createPostgresArticleFieldStore,
  createPostgresDeliveryRecordStore,
  createPostgresResponseHashStore,
  createPostgresFeedRetryStore,
} from "../src/postgres";
import type { ArticleFieldStore } from "../src/article-comparison";
import type { DeliveryRecordStore } from "../src/delivery-record-store";
import type { ResponseHashStore } from "../src/feed-event-handler";
import type { FeedRetryStore } from "../src/feed-retry-store";
import {
  createTestDiscordRestClient,
  type DiscordRestClient,
} from "../src/discord-rest";
import {
  createTestFeedRequestsServer,
  type TestFeedRequestsServer,
} from "./test-feed-requests-server";

// ============================================================================
// Test Infrastructure State
// ============================================================================

let sql: SQL | null = null;
let articleFieldStore: ArticleFieldStore | null = null;
let deliveryRecordStore: DeliveryRecordStore | null = null;
let responseHashStore: ResponseHashStore | null = null;
let feedRetryStore: FeedRetryStore | null = null;
let discordClient: DiscordRestClient | null = null;
let testFeedRequestsServer: TestFeedRequestsServer | null = null;

// ============================================================================
// Setup Functions
// ============================================================================

/**
 * Initialize the test database connection and run migrations.
 * Call this in beforeAll.
 */
export async function setupIntegrationTests(): Promise<{
  sql: SQL;
  articleFieldStore: ArticleFieldStore;
  deliveryRecordStore: DeliveryRecordStore;
  responseHashStore: ResponseHashStore;
  feedRetryStore: FeedRetryStore;
  discordClient: DiscordRestClient;
  testFeedRequestsServer: TestFeedRequestsServer;
}> {
  // Start the test feed-requests server
  testFeedRequestsServer = createTestFeedRequestsServer(5556);

  // Get connection string from environment
  const postgresUri =
    process.env.USER_FEEDS_POSTGRES_URI ||
    "postgres://postgres:postgres@localhost:5433/userfeeds_test";

  // Initialize the SQL client
  sql = initSqlClient(postgresUri);

  // Run migrations (creates tables if they don't exist)
  await runMigrations(sql);

  // Ensure partitions exist for current/next month
  await ensurePartitionsExist(sql);

  // Create stores
  articleFieldStore = createPostgresArticleFieldStore(sql);
  deliveryRecordStore = createPostgresDeliveryRecordStore(sql);
  responseHashStore = createPostgresResponseHashStore(sql);
  feedRetryStore = createPostgresFeedRetryStore(sql);
  discordClient = createTestDiscordRestClient();

  return {
    sql,
    articleFieldStore,
    deliveryRecordStore,
    responseHashStore,
    feedRetryStore,
    discordClient,
    testFeedRequestsServer,
  };
}

/**
 * Clean up test database state between tests.
 * Call this in beforeEach.
 */
export async function cleanupTestData(): Promise<void> {
  if (!sql) {
    throw new Error(
      "SQL client not initialized. Call setupIntegrationTests first."
    );
  }

  await truncateAllTables(sql);
}

/**
 * Tear down the test database connection.
 * Call this in afterAll.
 */
export async function teardownIntegrationTests(): Promise<void> {
  if (testFeedRequestsServer) {
    testFeedRequestsServer.server.stop();
    testFeedRequestsServer = null;
  }

  await closeSqlClient();
  sql = null;
  articleFieldStore = null;
  deliveryRecordStore = null;
  responseHashStore = null;
  feedRetryStore = null;
}

/**
 * Get the current stores (throws if not initialized).
 */
export function getStores(): {
  sql: SQL;
  articleFieldStore: ArticleFieldStore;
  deliveryRecordStore: DeliveryRecordStore;
  responseHashStore: ResponseHashStore;
  feedRetryStore: FeedRetryStore;
  discordClient: DiscordRestClient;
  feedRequestsServiceHost: string;
} {
  if (
    !sql ||
    !articleFieldStore ||
    !deliveryRecordStore ||
    !responseHashStore ||
    !feedRetryStore ||
    !discordClient ||
    !testFeedRequestsServer
  ) {
    throw new Error(
      "Stores not initialized. Call setupIntegrationTests first."
    );
  }

  return {
    sql,
    articleFieldStore,
    deliveryRecordStore,
    responseHashStore,
    feedRetryStore,
    discordClient: discordClient!,
    feedRequestsServiceHost: `http://localhost:${testFeedRequestsServer.port}`,
  };
}

/**
 * Get the test feed-requests server (throws if not initialized).
 */
export function getTestFeedRequestsServer(): TestFeedRequestsServer {
  if (!testFeedRequestsServer) {
    throw new Error(
      "Test feed-requests server not initialized. Call setupIntegrationTests first."
    );
  }

  return testFeedRequestsServer;
}

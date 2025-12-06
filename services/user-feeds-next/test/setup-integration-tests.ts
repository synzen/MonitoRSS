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

// ============================================================================
// Test Infrastructure State
// ============================================================================

let sql: SQL | null = null;
let articleFieldStore: ArticleFieldStore | null = null;
let deliveryRecordStore: DeliveryRecordStore | null = null;
let responseHashStore: ResponseHashStore | null = null;
let feedRetryStore: FeedRetryStore | null = null;

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
}> {
  // Get connection string from environment
  const postgresUri =
    process.env.USER_FEEDS_NEXT_POSTGRES_URI ||
    "postgres://postgres:postgres@localhost:5433/userfeeds_test";

  console.log(`Connecting to PostgreSQL at ${postgresUri}`);

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

  console.log("Integration test setup complete");

  return {
    sql,
    articleFieldStore,
    deliveryRecordStore,
    responseHashStore,
    feedRetryStore,
  };
}

/**
 * Clean up test database state between tests.
 * Call this in beforeEach.
 */
export async function cleanupTestData(): Promise<void> {
  if (!sql) {
    throw new Error("SQL client not initialized. Call setupIntegrationTests first.");
  }

  await truncateAllTables(sql);
  console.log("Truncated all tables");
}

/**
 * Tear down the test database connection.
 * Call this in afterAll.
 */
export async function teardownIntegrationTests(): Promise<void> {
  await closeSqlClient();
  sql = null;
  articleFieldStore = null;
  deliveryRecordStore = null;
  responseHashStore = null;
  feedRetryStore = null;
  console.log("Integration test teardown complete");
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
} {
  if (
    !sql ||
    !articleFieldStore ||
    !deliveryRecordStore ||
    !responseHashStore ||
    !feedRetryStore
  ) {
    throw new Error("Stores not initialized. Call setupIntegrationTests first.");
  }

  return {
    sql,
    articleFieldStore,
    deliveryRecordStore,
    responseHashStore,
    feedRetryStore,
  };
}

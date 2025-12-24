import { Client, Pool } from "pg";
import {
  createPostgresArticleFieldStore,
  createPostgresDeliveryRecordStore,
  createPostgresResponseHashStore,
  createPostgresFeedRetryStore,
} from "../../src/stores/postgres";
import type { ArticleFieldStore } from "../../src/articles/comparison";
import type { DeliveryRecordStore } from "../../src/stores/interfaces/delivery-record-store";
import type { ResponseHashStore } from "../../src/feeds/feed-event-handler";
import type { FeedRetryStore } from "../../src/stores/interfaces/feed-retry-store";
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
  discordClient: DiscordRestClient;
  feedRequestsServiceHost: string;
}

// ============================================================================
// Per-File State (each test file gets its own module instance)
// ============================================================================

let testPool: Pool | null = null;
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
export async function setupTestDatabase(): Promise<TestStores> {
  currentDatabaseName = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const testServer = getOrCreateTestServer();

  // Clone from template using simple Client
  const adminClient = new Client({ connectionString: getAdminUri() });
  await adminClient.connect();
  await adminClient.query(`CREATE DATABASE "${currentDatabaseName}" TEMPLATE ${TEMPLATE_DB_NAME}`);
  await adminClient.end();

  // Connect to the new test database with a Pool
  testPool = new Pool({ connectionString: getTestDbUri(currentDatabaseName), max: 10 });

  // Create stores
  return {
    pool: testPool,
    articleFieldStore: createPostgresArticleFieldStore(testPool),
    deliveryRecordStore: createPostgresDeliveryRecordStore(testPool),
    responseHashStore: createPostgresResponseHashStore(testPool),
    feedRetryStore: createPostgresFeedRetryStore(testPool),
    discordClient: createTestDiscordRestClient(),
    feedRequestsServiceHost: `http://localhost:${testServer.port}`,
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

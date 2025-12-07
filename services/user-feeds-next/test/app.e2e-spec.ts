import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  mock,
} from "bun:test";
import { randomUUID } from "crypto";
import { handleFeedV2Event } from "../src/feed-event-handler";
import { FeedResponseRequestStatus } from "../src/feed-fetcher";
import {
  ArticleDeliveryStatus,
  initializeDiscordProducer,
  initializeDiscordApiClient,
} from "../src/delivery";
import {
  setupIntegrationTests,
  cleanupTestData,
  teardownIntegrationTests,
  getStores,
} from "./setup-integration-tests";
import getTestRssFeed, { DEFAULT_TEST_ARTICLES } from "./data/test-rss-feed";
import generateTestFeedV2Event from "./data/test-feed-v2-event";
import type { FeedV2Event } from "../src/schemas";

// Mock the fetchFeed function
let mockFetchFeed = mock(async () => ({
  requestStatus: FeedResponseRequestStatus.Success,
  body: getTestRssFeed(),
  bodyHash: "bodyhash",
}));

// Capture Discord API payloads for assertion
interface CapturedPayload {
  url: string;
  options: { method: string; body: string };
  meta: Record<string, unknown>;
}
let capturedPayloads: CapturedPayload[] = [];

// Apply mocks before import
mock.module("../src/feed-fetcher/feed-fetcher", () => ({
  fetchFeed: () => mockFetchFeed(),
  FeedResponseRequestStatus,
}));

// Mock @synzen/discord-rest to capture Discord API payloads
mock.module("@synzen/discord-rest", () => ({
  RESTProducer: class MockRESTProducer {
    async initialize() {}
    async enqueue(
      url: string,
      options: { method: string; body: string },
      meta: Record<string, unknown>
    ) {
      capturedPayloads.push({ url, options, meta });
      // Return a mock job response that indicates success
      return {
        state: "success",
        status: 200,
        body: { id: randomUUID() },
      };
    }
  },
  RESTHandler: class MockRESTHandler {
    async fetch(_url: string, _options: unknown) {
      const responseBody = { id: randomUUID() };
      // Return a Response-like object with json() method
      return {
        status: 200,
        json: async () => responseBody,
      };
    }
  },
}));

describe("App (e2e)", () => {
  const setupTestCase = async (overrideEvent?: FeedV2Event) => {
    // Get the stores from setup
    const stores = getStores();

    const testFeedV2Event = overrideEvent || generateTestFeedV2Event();

    // Run initial event to seed the article store with baseline articles
    await handleFeedV2Event(testFeedV2Event, {
      articleFieldStore: stores.articleFieldStore,
      deliveryRecordStore: stores.deliveryRecordStore,
      responseHashStore: stores.responseHashStore,
      feedRetryStore: stores.feedRetryStore,
    });
    capturedPayloads = [];

    return {
      testFeedV2Event,
    };
  };

  beforeAll(async () => {
    await setupIntegrationTests();
    // Initialize Discord producer with mock RabbitMQ URI (won't actually connect due to mock)
    await initializeDiscordProducer({
      rabbitmqUri: "amqp://localhost",
      clientId: "test-client",
    });
    // Initialize Discord API client with mock token
    initializeDiscordApiClient("test-token");
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  });

  beforeEach(async () => {
    // Clean up database tables
    await cleanupTestData();

    // Clear captured payloads
    capturedPayloads = [];

    // Reset mocks to default behavior
    mockFetchFeed = mock(async () => ({
      requestStatus: FeedResponseRequestStatus.Success,
      body: getTestRssFeed(),
      bodyHash: "bodyhash",
    }));
  });

  it("sends new articles based on guid", async () => {
    const stores = getStores();

    // Clear captured payloads from initialization
    capturedPayloads = [];

    const { testFeedV2Event } = await setupTestCase();

    // Override fetch to return ONLY a new article (replace: true)
    // This simulates a feed where a new article appeared and old one dropped off
    mockFetchFeed = mock(async () => ({
      requestStatus: FeedResponseRequestStatus.Success,
      body: getTestRssFeed(
        [{ guid: "new-article", title: "New Article Title" }],
        true
      ),
      bodyHash: randomUUID(),
    }));

    const results = await handleFeedV2Event(testFeedV2Event, {
      articleFieldStore: stores.articleFieldStore,
      deliveryRecordStore: stores.deliveryRecordStore,
      responseHashStore: stores.responseHashStore,
      feedRetryStore: stores.feedRetryStore,
    });

    expect(results).not.toBeNull();
    expect(results!.length).toBe(1);
    // Channel delivery is asynchronous, so status is PendingDelivery
    expect(results![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);
  });

  it("does not send new articles if blocked by comparisons", async () => {
    const stores = getStores();

    const baseEvent = generateTestFeedV2Event();
    const baseEventWithBlockingComparisons = {
      ...baseEvent,
      data: {
        ...baseEvent.data,
        feed: {
          ...baseEvent.data.feed,
          blockingComparisons: ["title"],
        },
      },
    };

    const { testFeedV2Event } = await setupTestCase(
      baseEventWithBlockingComparisons
    );

    // Initialize the comparisons storage first
    await handleFeedV2Event(testFeedV2Event, {
      articleFieldStore: stores.articleFieldStore,
      deliveryRecordStore: stores.deliveryRecordStore,
      responseHashStore: stores.responseHashStore,
      feedRetryStore: stores.feedRetryStore,
    });

    // Fetch returns article with different guid but same title as existing article
    mockFetchFeed = mock(async () => ({
      requestStatus: FeedResponseRequestStatus.Success,
      body: getTestRssFeed([
        {
          guid: randomUUID(),
          title: DEFAULT_TEST_ARTICLES[0]!.title,
        },
      ]),
      bodyHash: randomUUID(),
    }));

    const results = await handleFeedV2Event(testFeedV2Event, {
      articleFieldStore: stores.articleFieldStore,
      deliveryRecordStore: stores.deliveryRecordStore,
      responseHashStore: stores.responseHashStore,
      feedRetryStore: stores.feedRetryStore,
    });

    expect(results).not.toBeNull();
    expect(results!.length).toBe(0);
  });

  it("sends new articles based on passing comparisons", async () => {
    const stores = getStores();

    const baseEvent = generateTestFeedV2Event();
    const baseEventWithPassingComparisons = {
      ...baseEvent,
      data: {
        ...baseEvent.data,
        feed: {
          ...baseEvent.data.feed,
          passingComparisons: ["title"],
        },
      },
    };

    const { testFeedV2Event } = await setupTestCase(
      baseEventWithPassingComparisons
    );

    // Initialize the comparisons storage first
    await handleFeedV2Event(testFeedV2Event, {
      articleFieldStore: stores.articleFieldStore,
      deliveryRecordStore: stores.deliveryRecordStore,
      responseHashStore: stores.responseHashStore,
      feedRetryStore: stores.feedRetryStore,
    });

    // Fetch returns article with same guid but different title
    mockFetchFeed = mock(async () => ({
      requestStatus: FeedResponseRequestStatus.Success,
      body: getTestRssFeed(
        [
          {
            guid: DEFAULT_TEST_ARTICLES[0]!.guid,
            title: DEFAULT_TEST_ARTICLES[0]!.title + "-different",
          },
        ],
        true
      ),
      bodyHash: randomUUID(),
    }));

    const results = await handleFeedV2Event(testFeedV2Event, {
      articleFieldStore: stores.articleFieldStore,
      deliveryRecordStore: stores.deliveryRecordStore,
      responseHashStore: stores.responseHashStore,
      feedRetryStore: stores.feedRetryStore,
    });

    expect(results).not.toBeNull();
    expect(results!.length).toBe(1);
    // Channel delivery is asynchronous, so status is PendingDelivery
    expect(results![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);

    // Test again with another different title
    mockFetchFeed = mock(async () => ({
      requestStatus: FeedResponseRequestStatus.Success,
      body: getTestRssFeed(
        [
          {
            guid: DEFAULT_TEST_ARTICLES[0]!.guid,
            title: DEFAULT_TEST_ARTICLES[0]!.title + "-different2",
          },
        ],
        true
      ),
      bodyHash: randomUUID(),
    }));

    const results2 = await handleFeedV2Event(testFeedV2Event, {
      articleFieldStore: stores.articleFieldStore,
      deliveryRecordStore: stores.deliveryRecordStore,
      responseHashStore: stores.responseHashStore,
      feedRetryStore: stores.feedRetryStore,
    });

    expect(results2).not.toBeNull();
    expect(results2!.length).toBe(1);
    // Channel delivery is asynchronous, so status is PendingDelivery
    expect(results2![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);
  });

  it("does not send new articles based on passing comparisons if there are no new articles", async () => {
    const stores = getStores();

    const baseEvent = generateTestFeedV2Event();
    const baseEventWithPassingComparisons = {
      ...baseEvent,
      data: {
        ...baseEvent.data,
        feed: {
          ...baseEvent.data.feed,
          passingComparisons: ["rss:title__#"],
        },
      },
    };

    const { testFeedV2Event } = await setupTestCase(
      baseEventWithPassingComparisons
    );

    // Initialize the comparisons storage first
    await handleFeedV2Event(testFeedV2Event, {
      articleFieldStore: stores.articleFieldStore,
      deliveryRecordStore: stores.deliveryRecordStore,
      responseHashStore: stores.responseHashStore,
      feedRetryStore: stores.feedRetryStore,
    });

    // Fetch returns the same articles (no new articles, no title change)
    mockFetchFeed = mock(async () => ({
      requestStatus: FeedResponseRequestStatus.Success,
      body: getTestRssFeed(),
      bodyHash: randomUUID(),
    }));

    const results = await handleFeedV2Event(testFeedV2Event, {
      articleFieldStore: stores.articleFieldStore,
      deliveryRecordStore: stores.deliveryRecordStore,
      responseHashStore: stores.responseHashStore,
      feedRetryStore: stores.feedRetryStore,
    });

    expect(results).not.toBeNull();
    expect(results!.length).toBe(0);
  });

  it("formats HTML to Discord markdown in delivered payloads", async () => {
    const stores = getStores();

    const testFeedV2Event = generateTestFeedV2Event();

    // Override the test event to use rss:title__# (raw title with HTML)
    // because feedparser strips HTML from the "title" field automatically
    const baseMedium = testFeedV2Event.data.mediums[0]!;
    const feedEventWithRawTitle = {
      ...testFeedV2Event,
      data: {
        ...testFeedV2Event.data,
        mediums: [
          {
            ...baseMedium,
            details: {
              ...baseMedium.details,
              content: "{{description}}",
            },
          },
        ],
      },
    };

    await setupTestCase(feedEventWithRawTitle);

    // Feed returns article with HTML content
    mockFetchFeed = mock(async () => ({
      requestStatus: FeedResponseRequestStatus.Success,
      body: getTestRssFeed([
        {
          guid: "html-article",
          description: "<strong>Bold</strong> and <em>italic</em>",
        },
      ]),
      bodyHash: randomUUID(),
    }));

    console.log("Starting test case");
    const results = await handleFeedV2Event(feedEventWithRawTitle, {
      articleFieldStore: stores.articleFieldStore,
      deliveryRecordStore: stores.deliveryRecordStore,
      responseHashStore: stores.responseHashStore,
      feedRetryStore: stores.feedRetryStore,
    });

    expect(results).not.toBeNull();
    expect(results!.length).toBe(1);
    // Channel delivery is asynchronous, so status is PendingDelivery
    expect(results![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);

    // Check the payload that was sent to Discord
    expect(capturedPayloads.length).toBeGreaterThan(0);
    const payload = JSON.parse(capturedPayloads[0]!.options.body);

    // Verify HTML was converted to Discord markdown
    expect(payload.content).toContain("**Bold**");
    expect(payload.content).toContain("*italic*");
    expect(payload.content).not.toContain("<b>");
    expect(payload.content).not.toContain("<i>");
  });
});

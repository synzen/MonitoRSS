import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "bun:test";
import { randomUUID } from "crypto";
import { handleFeedV2Event } from "../src/feed-event-handler";
import { ArticleDeliveryStatus } from "../src/delivery";
import {
  createTestDiscordRestClient,
  type TestDiscordRestClient,
} from "../src/discord-rest";
import {
  setupIntegrationTests,
  teardownIntegrationTests,
  getStores,
  getTestFeedRequestsServer,
} from "./setup-integration-tests";
import getTestRssFeed, { DEFAULT_TEST_ARTICLES } from "./data/test-rss-feed";
import generateTestFeedV2Event from "./data/test-feed-v2-event";
import type { FeedV2Event } from "../src/schemas";

describe("App (e2e)", () => {
  const setupTestCase = async (
    discordClient: TestDiscordRestClient,
    overrideEvent?: FeedV2Event
  ) => {
    // Get the stores from setup
    const stores = getStores();

    const testFeedV2Event = overrideEvent || generateTestFeedV2Event();

    // Run initial event to seed the article store with baseline articles
    await handleFeedV2Event(testFeedV2Event, {
      articleFieldStore: stores.articleFieldStore,
      deliveryRecordStore: stores.deliveryRecordStore,
      responseHashStore: stores.responseHashStore,
      feedRetryStore: stores.feedRetryStore,
      feedRequestsServiceHost: stores.feedRequestsServiceHost,
      discordClient,
    });
    // Clear captured payloads from initialization
    discordClient.clear();

    return {
      testFeedV2Event,
    };
  };

  beforeAll(async () => {
    await setupIntegrationTests();
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  });

  beforeEach(async () => {
    // Reset server to default behavior
    const testServer = getTestFeedRequestsServer();
    testServer.setResponse(() => ({
      body: getTestRssFeed(),
    }));
    testServer.clear();
  });

  it("sends new articles based on guid", async () => {
    const stores = getStores();
    const testServer = getTestFeedRequestsServer();
    const discordClient: TestDiscordRestClient = createTestDiscordRestClient();

    const { testFeedV2Event } = await setupTestCase(discordClient);

    // Override fetch to return ONLY a new article (replace: true)
    // This simulates a feed where a new article appeared and old one dropped off
    testServer.setResponse(() => ({
      body: getTestRssFeed(
        [{ guid: "new-article", title: "New Article Title" }],
        true
      ),
      hash: randomUUID(),
    }));

    const results = await handleFeedV2Event(testFeedV2Event, {
      articleFieldStore: stores.articleFieldStore,
      deliveryRecordStore: stores.deliveryRecordStore,
      responseHashStore: stores.responseHashStore,
      feedRetryStore: stores.feedRetryStore,
      feedRequestsServiceHost: stores.feedRequestsServiceHost,
      discordClient,
    });

    expect(results).not.toBeNull();
    expect(results!.length).toBe(1);
    // Channel delivery is asynchronous, so status is PendingDelivery
    expect(results![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);
    // Verify Discord API was called
    expect(discordClient.capturedPayloads.length).toBe(1);
  });

  it("does not send new articles if blocked by comparisons", async () => {
    const stores = getStores();
    const testServer = getTestFeedRequestsServer();
    const discordClient: TestDiscordRestClient = createTestDiscordRestClient();

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
      discordClient,
      baseEventWithBlockingComparisons
    );

    // Initialize the comparisons storage first
    await handleFeedV2Event(testFeedV2Event, {
      articleFieldStore: stores.articleFieldStore,
      deliveryRecordStore: stores.deliveryRecordStore,
      responseHashStore: stores.responseHashStore,
      feedRetryStore: stores.feedRetryStore,
      feedRequestsServiceHost: stores.feedRequestsServiceHost,
      discordClient,
    });

    // Fetch returns article with different guid but same title as existing article
    testServer.setResponse(() => ({
      body: getTestRssFeed([
        {
          guid: randomUUID(),
          title: DEFAULT_TEST_ARTICLES[0]!.title,
        },
      ]),
      hash: randomUUID(),
    }));

    const results = await handleFeedV2Event(testFeedV2Event, {
      articleFieldStore: stores.articleFieldStore,
      deliveryRecordStore: stores.deliveryRecordStore,
      responseHashStore: stores.responseHashStore,
      feedRetryStore: stores.feedRetryStore,
      feedRequestsServiceHost: stores.feedRequestsServiceHost,
      discordClient,
    });

    expect(results).not.toBeNull();
    expect(results!.length).toBe(0);
  });

  it("sends new articles based on passing comparisons", async () => {
    const stores = getStores();
    const testServer = getTestFeedRequestsServer();
    const discordClient: TestDiscordRestClient = createTestDiscordRestClient();

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
      discordClient,
      baseEventWithPassingComparisons
    );

    // Initialize the comparisons storage first
    await handleFeedV2Event(testFeedV2Event, {
      articleFieldStore: stores.articleFieldStore,
      deliveryRecordStore: stores.deliveryRecordStore,
      responseHashStore: stores.responseHashStore,
      feedRetryStore: stores.feedRetryStore,
      feedRequestsServiceHost: stores.feedRequestsServiceHost,
      discordClient,
    });

    // Fetch returns article with same guid but different title
    testServer.setResponse(() => ({
      body: getTestRssFeed(
        [
          {
            guid: DEFAULT_TEST_ARTICLES[0]!.guid,
            title: DEFAULT_TEST_ARTICLES[0]!.title + "-different",
          },
        ],
        true
      ),
      hash: randomUUID(),
    }));

    const results = await handleFeedV2Event(testFeedV2Event, {
      articleFieldStore: stores.articleFieldStore,
      deliveryRecordStore: stores.deliveryRecordStore,
      responseHashStore: stores.responseHashStore,
      feedRetryStore: stores.feedRetryStore,
      feedRequestsServiceHost: stores.feedRequestsServiceHost,
      discordClient,
    });

    expect(results).not.toBeNull();
    expect(results!.length).toBe(1);
    // Channel delivery is asynchronous, so status is PendingDelivery
    expect(results![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);

    // Test again with another different title
    testServer.setResponse(() => ({
      body: getTestRssFeed(
        [
          {
            guid: DEFAULT_TEST_ARTICLES[0]!.guid,
            title: DEFAULT_TEST_ARTICLES[0]!.title + "-different2",
          },
        ],
        true
      ),
      hash: randomUUID(),
    }));

    const results2 = await handleFeedV2Event(testFeedV2Event, {
      articleFieldStore: stores.articleFieldStore,
      deliveryRecordStore: stores.deliveryRecordStore,
      responseHashStore: stores.responseHashStore,
      feedRetryStore: stores.feedRetryStore,
      feedRequestsServiceHost: stores.feedRequestsServiceHost,
      discordClient,
    });

    expect(results2).not.toBeNull();
    expect(results2!.length).toBe(1);
    // Channel delivery is asynchronous, so status is PendingDelivery
    expect(results2![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);
  });

  it("does not send new articles based on passing comparisons if there are no new articles", async () => {
    const stores = getStores();
    const testServer = getTestFeedRequestsServer();
    const discordClient: TestDiscordRestClient = createTestDiscordRestClient();

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
      discordClient,
      baseEventWithPassingComparisons
    );

    // Initialize the comparisons storage first
    await handleFeedV2Event(testFeedV2Event, {
      articleFieldStore: stores.articleFieldStore,
      deliveryRecordStore: stores.deliveryRecordStore,
      responseHashStore: stores.responseHashStore,
      feedRetryStore: stores.feedRetryStore,
      feedRequestsServiceHost: stores.feedRequestsServiceHost,
      discordClient,
    });

    // Fetch returns the same articles (no new articles, no title change)
    testServer.setResponse(() => ({
      body: getTestRssFeed(),
      hash: randomUUID(),
    }));

    const results = await handleFeedV2Event(testFeedV2Event, {
      articleFieldStore: stores.articleFieldStore,
      deliveryRecordStore: stores.deliveryRecordStore,
      responseHashStore: stores.responseHashStore,
      feedRetryStore: stores.feedRetryStore,
      feedRequestsServiceHost: stores.feedRequestsServiceHost,
      discordClient,
    });

    expect(results).not.toBeNull();
    expect(results!.length).toBe(0);
  });

  it("formats HTML to Discord markdown in delivered payloads", async () => {
    const stores = getStores();
    const testServer = getTestFeedRequestsServer();
    const discordClient: TestDiscordRestClient = createTestDiscordRestClient();

    const testFeedV2Event = generateTestFeedV2Event();

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

    await setupTestCase(discordClient, feedEventWithRawTitle);

    // Feed returns article with HTML content
    testServer.setResponse(() => ({
      body: getTestRssFeed([
        {
          guid: "html-article",
          description: "<strong>Bold</strong> and <em>italic</em>",
        },
      ]),
      hash: randomUUID(),
    }));

    const results = await handleFeedV2Event(feedEventWithRawTitle, {
      articleFieldStore: stores.articleFieldStore,
      deliveryRecordStore: stores.deliveryRecordStore,
      responseHashStore: stores.responseHashStore,
      feedRetryStore: stores.feedRetryStore,
      feedRequestsServiceHost: stores.feedRequestsServiceHost,
      discordClient,
    });

    expect(results).not.toBeNull();
    expect(results!.length).toBe(1);
    // Channel delivery is asynchronous, so status is PendingDelivery
    expect(results![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);

    // Check the payload that was sent to Discord
    expect(discordClient.capturedPayloads.length).toBeGreaterThan(0);
    const payload = JSON.parse(
      discordClient.capturedPayloads[0]!.options.body as string
    );

    // Verify HTML was converted to Discord markdown
    expect(payload.content).toContain("**Bold**");
    expect(payload.content).toContain("*italic*");
    expect(payload.content).not.toContain("<strong>");
    expect(payload.content).not.toContain("<em>");
  });
});

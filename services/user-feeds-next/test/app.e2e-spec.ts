import { describe, it, expect, beforeAll, afterAll, beforeEach, mock } from "bun:test";
import { randomUUID } from "crypto";
import { handleFeedV2Event } from "../src/feed-event-handler";
import { FeedResponseRequestStatus } from "../src/feed-fetcher";
import { ArticleDeliveryStatus, ArticleDeliveryContentType } from "../src/delivery";
import { generateDeliveryId } from "../src/delivery-record-store";
import type { ArticleDeliveryState } from "../src/delivery-record-store";
import type { Article } from "../src/article-parser";
import {
  setupIntegrationTests,
  cleanupTestData,
  teardownIntegrationTests,
  getStores,
} from "./setup-integration-tests";
import testFeedV2Event from "./data/test-feed-v2-event";
import getTestRssFeed, { DEFAULT_TEST_ARTICLES } from "./data/test-rss-feed";

// Mock the fetchFeed function
let mockFetchFeed = mock(async () => ({
  requestStatus: FeedResponseRequestStatus.Success,
  body: getTestRssFeed(),
  bodyHash: "bodyhash",
}));

// Mock the deliverArticles function
const mockDeliverArticles = mock(
  async (articles: Article[], _mediums: unknown[], _options: unknown) => {
    return articles.map((article) => ({
      id: generateDeliveryId(),
      articleIdHash: article.flattened.idHash,
      status: ArticleDeliveryStatus.Sent,
      mediumId: "medium-id",
      contentType: ArticleDeliveryContentType.DiscordArticleMessage,
      article,
    })) as ArticleDeliveryState[];
  }
);

// Apply mocks before import
mock.module("../src/feed-fetcher/feed-fetcher", () => ({
  fetchFeed: () => mockFetchFeed(),
  FeedResponseRequestStatus,
}));

mock.module("../src/delivery/delivery", () => ({
  deliverArticles: (
    articles: Article[],
    mediums: unknown[],
    options: unknown
  ) => mockDeliverArticles(articles, mediums, options),
  ArticleDeliveryStatus,
  ArticleDeliveryContentType,
  ArticleDeliveryErrorCode: {},
  ArticleDeliveryRejectedCode: {},
  processDeliveryResult: () => null,
  getUnderLimitCheck: () => async () => ({ ok: true }),
  initializeDiscordProducer: async () => {},
  closeDiscordProducer: async () => {},
  initializeDiscordApiClient: async () => {},
  closeDiscordApiClient: async () => {},
}));

describe("App (e2e)", () => {
  beforeAll(async () => {
    await setupIntegrationTests();
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  });

  beforeEach(async () => {
    // Clean up database tables
    await cleanupTestData();

    // Reset mocks to default behavior
    mockFetchFeed = mock(async () => ({
      requestStatus: FeedResponseRequestStatus.Success,
      body: getTestRssFeed(),
      bodyHash: "bodyhash",
    }));

    mockDeliverArticles.mockReset();
    mockDeliverArticles.mockImplementation(
      async (articles: Article[], _mediums: unknown[], _options: unknown) => {
        return articles.map((article) => ({
          id: generateDeliveryId(),
          articleIdHash: article.flattened.idHash,
          status: ArticleDeliveryStatus.Sent,
          mediumId: "medium-id",
          contentType: ArticleDeliveryContentType.DiscordArticleMessage,
          article,
        })) as ArticleDeliveryState[];
      }
    );

    // Get the stores from setup
    const stores = getStores();

    // Run initial event to seed the article store with baseline articles
    await handleFeedV2Event(testFeedV2Event, {
      articleFieldStore: stores.articleFieldStore,
      deliveryRecordStore: stores.deliveryRecordStore,
      responseHashStore: stores.responseHashStore,
      feedRetryStore: stores.feedRetryStore,
    });
  });

  it("sends new articles based on guid", async () => {
    const stores = getStores();

    // Override fetch to return a new article
    mockFetchFeed = mock(async () => ({
      requestStatus: FeedResponseRequestStatus.Success,
      body: getTestRssFeed([{ guid: "new-article" }]),
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
    expect(results![0]!.status).toBe(ArticleDeliveryStatus.Sent);
  });

  it("does not send new articles if blocked by comparisons", async () => {
    const stores = getStores();

    const feedEventWithBlockingComparisons = {
      ...testFeedV2Event,
      data: {
        ...testFeedV2Event.data,
        feed: {
          ...testFeedV2Event.data.feed,
          blockingComparisons: ["title"],
        },
      },
    };

    // Initialize the comparisons storage first
    await handleFeedV2Event(feedEventWithBlockingComparisons, {
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

    const results = await handleFeedV2Event(feedEventWithBlockingComparisons, {
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

    const feedEventWithPassingComparisons = {
      ...testFeedV2Event,
      data: {
        ...testFeedV2Event.data,
        feed: {
          ...testFeedV2Event.data.feed,
          passingComparisons: ["title"],
        },
      },
    };

    // Initialize the comparisons storage first
    await handleFeedV2Event(feedEventWithPassingComparisons, {
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

    const results = await handleFeedV2Event(feedEventWithPassingComparisons, {
      articleFieldStore: stores.articleFieldStore,
      deliveryRecordStore: stores.deliveryRecordStore,
      responseHashStore: stores.responseHashStore,
      feedRetryStore: stores.feedRetryStore,
    });

    expect(results).not.toBeNull();
    expect(results!.length).toBe(1);
    expect(results![0]!.status).toBe(ArticleDeliveryStatus.Sent);

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

    const results2 = await handleFeedV2Event(feedEventWithPassingComparisons, {
      articleFieldStore: stores.articleFieldStore,
      deliveryRecordStore: stores.deliveryRecordStore,
      responseHashStore: stores.responseHashStore,
      feedRetryStore: stores.feedRetryStore,
    });

    expect(results2).not.toBeNull();
    expect(results2!.length).toBe(1);
    expect(results2![0]!.status).toBe(ArticleDeliveryStatus.Sent);
  });

  it("does not send new articles based on passing comparisons if there are no new articles", async () => {
    const stores = getStores();

    const feedEventWithPassingComparisons = {
      ...testFeedV2Event,
      data: {
        ...testFeedV2Event.data,
        feed: {
          ...testFeedV2Event.data.feed,
          passingComparisons: ["rss:title__#"],
        },
      },
    };

    // Initialize the comparisons storage first
    await handleFeedV2Event(feedEventWithPassingComparisons, {
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

    const results = await handleFeedV2Event(feedEventWithPassingComparisons, {
      articleFieldStore: stores.articleFieldStore,
      deliveryRecordStore: stores.deliveryRecordStore,
      responseHashStore: stores.responseHashStore,
      feedRetryStore: stores.feedRetryStore,
    });

    expect(results).not.toBeNull();
    expect(results!.length).toBe(0);
  });
});

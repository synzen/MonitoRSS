import {
  getStores,
  getTestFeedRequestsServer,
} from "../setup-integration-tests";
import {
  createTestDiscordRestClient,
  type TestDiscordRestClient,
} from "../../src/discord-rest";
import { handleFeedV2Event } from "../../src/feed-event-handler";
import generateTestFeedV2Event from "../data/test-feed-v2-event";
import getTestRssFeed from "../data/test-rss-feed";
import type { FeedV2Event } from "../../src/schemas";

interface TestArticle {
  guid: string;
  title?: string;
  [key: string]: string | undefined;
}

export interface TestContext {
  feedUrl: string;
  discordClient: TestDiscordRestClient;
  testFeedV2Event: FeedV2Event;

  /** Set response for this test's feed URL */
  setFeedResponse(fn: () => { body: string; hash?: string }): void;

  /** Get requests made for this test's feed URL */
  getRequests(): Array<{ url: string; body: unknown }>;

  /** Run the feed event handler */
  handleEvent(
    overrideEvent?: FeedV2Event
  ): ReturnType<typeof handleFeedV2Event>;

  /** Seed initial articles and clear Discord captures */
  seedArticles(event?: FeedV2Event): Promise<void>;

  /** Cleanup this test's state */
  cleanup(): void;
}

export interface CreateTestContextOptions {
  feedEventOverrides?: Partial<FeedV2Event["data"]["feed"]>;
  initialArticles?: TestArticle[];
}

export function createTestContext(
  options?: CreateTestContextOptions
): TestContext {
  const testServer = getTestFeedRequestsServer();
  const stores = getStores();
  const feedUrl = testServer.generateTestUrl();
  const discordClient = createTestDiscordRestClient();

  // Create event with unique URL
  const baseEvent = generateTestFeedV2Event({ feedUrl });

  // Apply any feed overrides
  const testFeedV2Event: FeedV2Event = options?.feedEventOverrides
    ? {
        ...baseEvent,
        data: {
          ...baseEvent.data,
          feed: {
            ...baseEvent.data.feed,
            ...options.feedEventOverrides,
          },
        },
      }
    : baseEvent;

  // Register default response for this URL
  testServer.registerUrl(feedUrl, () => ({
    body: getTestRssFeed(options?.initialArticles),
  }));

  return {
    feedUrl,
    discordClient,
    testFeedV2Event,

    setFeedResponse(fn) {
      testServer.registerUrl(feedUrl, fn);
    },

    getRequests() {
      return testServer.getRequestsForUrl(feedUrl);
    },

    async handleEvent(overrideEvent) {
      return handleFeedV2Event(overrideEvent ?? testFeedV2Event, {
        articleFieldStore: stores.articleFieldStore,
        deliveryRecordStore: stores.deliveryRecordStore,
        responseHashStore: stores.responseHashStore,
        feedRetryStore: stores.feedRetryStore,
        feedRequestsServiceHost: stores.feedRequestsServiceHost,
        discordClient,
      });
    },

    async seedArticles(event?: FeedV2Event) {
      await this.handleEvent(event);
      discordClient.clear();
    },

    cleanup() {
      testServer.clearUrl(feedUrl);
    },
  };
}

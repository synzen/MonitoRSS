/* eslint-disable max-len */
import { AppModule } from "./../src/app.module";
import {
  setupIntegrationTests,
  teardownIntegrationTests,
} from "../src/shared/utils/setup-integration-tests";
import { FeedEventHandlerService } from "../src/feed-event-handler/feed-event-handler.service";
import {
  Article,
  ArticleDeliveryContentType,
  ArticleDeliveryState,
  ArticleDeliveryStatus,
  ArticleDiscordFormatted,
  FeedResponseRequestStatus,
  FeedV2Event,
} from "../src/shared";
import { describe, before, after, it, beforeEach } from "node:test";
import { FeedFetcherService } from "../src/feed-fetcher/feed-fetcher.service";
import { DiscordMediumService } from "../src/delivery/mediums/discord-medium.service";
import { deepStrictEqual } from "assert";
import testFeedV2Event from "./data/test-feed-v2-event";
import getTestRssFeed, { DEFAULT_TEST_ARTICLES } from "./data/test-rss-feed";
import { randomUUID } from "crypto";
import pruneAndCreatePartitions from "../src/shared/utils/prune-and-create-partitions";
import { PartitionedFeedArticleFieldStoreService } from "../src/articles/partitioned-feed-article-field-store.service";

describe("App (e2e)", () => {
  let feedEventHandler: FeedEventHandlerService;
  let partitionedFeedArticleStoreService: PartitionedFeedArticleFieldStoreService;
  const feedFetcherService: FeedFetcherService = {
    fetch: async () => ({
      requestStatus: FeedResponseRequestStatus.Success,
      body: getTestRssFeed(),
      bodyHash: "bodyhash",
    }),
  } as never;
  const discordMediumService = {
    deliverArticle: async (article: ArticleDiscordFormatted) =>
      [
        {
          id: article.flattened.id,
          articleIdHash: article.flattened.idHash,
          status: ArticleDeliveryStatus.Sent,
          mediumId: "medium-id",
          contentType: ArticleDeliveryContentType.DiscordArticleMessage,
        },
      ] as ArticleDeliveryState[],
    formatArticle: async (article: Article) => article,
    close: async () => ({}),
  };

  before(async () => {
    const { uncompiledModule, init } = await setupIntegrationTests({
      imports: [AppModule.forFeedListenerService()],
    });

    uncompiledModule
      .overrideProvider(FeedFetcherService)
      .useValue(feedFetcherService)
      .overrideProvider(DiscordMediumService)
      .useValue(discordMediumService);

    const { module: appModule } = await init();
    feedEventHandler = appModule.get(FeedEventHandlerService);
    partitionedFeedArticleStoreService = appModule.get(
      PartitionedFeedArticleFieldStoreService
    );

    await pruneAndCreatePartitions(appModule);
  });

  after(async () => {
    await teardownIntegrationTests();
  });

  const runEvent = async (event: FeedV2Event) => {
    return partitionedFeedArticleStoreService.startContext(async () =>
      feedEventHandler.handleV2EventWithDb(event)
    );
  };

  beforeEach(async () => {
    await runEvent(testFeedV2Event);
  });

  it("sends new articles based on guid", async () => {
    feedFetcherService.fetch = async () => ({
      requestStatus: FeedResponseRequestStatus.Success,
      body: getTestRssFeed([
        {
          guid: "new-article",
        },
      ]),
      bodyHash: randomUUID(),
    });

    const results = await runEvent(testFeedV2Event);
    deepStrictEqual(results?.length, 1);
  });

  it("does not send new articles if blocked by comparisons", async () => {
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
    await runEvent(feedEventWithBlockingComparisons);

    feedFetcherService.fetch = async () => ({
      requestStatus: FeedResponseRequestStatus.Success,
      body: getTestRssFeed([
        {
          guid: randomUUID(),
          title: DEFAULT_TEST_ARTICLES[0].title,
        },
      ]),
      bodyHash: randomUUID(),
    });

    const results = await runEvent(feedEventWithBlockingComparisons);

    deepStrictEqual(results?.length, 0);
  });

  it("sends new articles based on passing comparisons", async () => {
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

    const initialArticles = [
      {
        guid: randomUUID(),
        title: DEFAULT_TEST_ARTICLES[0].title,
      },
    ];

    feedFetcherService.fetch = async () => ({
      requestStatus: FeedResponseRequestStatus.Success,
      body: getTestRssFeed(initialArticles),
      bodyHash: randomUUID(),
    });

    // Initialize the comparisons storage first
    await runEvent(feedEventWithPassingComparisons);

    feedFetcherService.fetch = async () => ({
      requestStatus: FeedResponseRequestStatus.Success,
      body: getTestRssFeed([
        {
          guid: initialArticles[0].guid,
          title: initialArticles[0].title + "-different",
        },
      ]),
      bodyHash: randomUUID(),
    });

    const results = await runEvent(feedEventWithPassingComparisons);

    deepStrictEqual(results?.length, 1);
  });

  it("does not send new articles based on passing comparisons if there are no new articles", async () => {
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
    await runEvent(feedEventWithPassingComparisons);

    feedFetcherService.fetch = async () => ({
      requestStatus: FeedResponseRequestStatus.Success,
      body: getTestRssFeed(),
      bodyHash: randomUUID(),
    });

    const results = await runEvent(feedEventWithPassingComparisons);

    deepStrictEqual(results?.length, 0);
  });
});

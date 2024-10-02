import { AppModule } from "./../src/app.module";
import {
  setupIntegrationTests,
  teardownIntegrationTests,
} from "../src/shared/utils/setup-integration-tests";
import { FeedEventHandlerService } from "../src/feed-event-handler/feed-event-handler.service";
import { readFileSync } from "fs";
import { join } from "path";
import {
  ArticleDeliveryContentType,
  ArticleDeliveryState,
  ArticleDeliveryStatus,
  FeedResponseRequestStatus,
  FeedV2Event,
  MediumKey,
} from "../src/shared";
import { describe, before, after, it } from "node:test";
import { FeedFetcherService } from "../src/feed-fetcher/feed-fetcher.service";
import { DiscordMediumService } from "../src/delivery/mediums/discord-medium.service";
import { XMLParser, XMLBuilder } from "fast-xml-parser";
import { deepStrictEqual } from "assert";

const feedId = "feed-id";
const feedHost = "https://feed.com";
const feedPath = "/rss";

const feedText = readFileSync(
  join(__dirname, "data", "rss-2-feed.xml"),
  "utf-8"
);

const addArticleToFeed = (
  input: string,
  article: {
    guid: string;
  }
) => {
  const parser = new XMLParser();
  const parsed: {
    rss: { channel: { item: Array<{ guid: string }> } };
  } = parser.parse(input);
  parsed.rss.channel.item.push(article);

  const builder = new XMLBuilder();

  const newFeedText = builder.build(parsed);

  return newFeedText;
};

describe("App (e2e)", () => {
  let feedEventHandler: FeedEventHandlerService;
  const feedFetcherService: FeedFetcherService = {
    fetchWithGrpc: async () => ({
      requestStatus: FeedResponseRequestStatus.Success,
      body: feedText,
      bodyHash: "bodyhash",
    }),
  } as never;
  const discordMediumService = {
    deliverArticle: async () =>
      [
        {
          id: "1",
          articleIdHash: "1",
          status: ArticleDeliveryStatus.Sent,
          mediumId: "medium-id",
          contentType: ArticleDeliveryContentType.DiscordArticleMessage,
        },
      ] as ArticleDeliveryState[],
    formatArticle: async () => ({
      flattened: {
        id: "id",
        idHash: "hash",
      },
      raw: {},
    }),
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

    const { module } = await init();
    feedEventHandler = module.get(FeedEventHandlerService);
  });

  after(async () => {
    await teardownIntegrationTests();
  });

  it("sends new articles", async () => {
    const event: FeedV2Event = {
      timestamp: new Date().getTime(),
      debug: true,
      data: {
        articleDayLimit: 1,
        feed: {
          id: feedId,
          blockingComparisons: [],
          passingComparisons: [],
          url: feedHost + feedPath,
        },
        mediums: [
          {
            id: "medium-id",
            key: MediumKey.Discord,
            filters: null,
            details: {
              guildId: "1",
              channel: { id: "channel 1" },
              content: "1",
              embeds: [],
              webhook: null,
              components: [],
              customPlaceholders: [],
              enablePlaceholderFallback: false,
              formatter: {
                disableImageLinkPreviews: false,
                formatTables: false,
                ignoreNewLines: false,
                stripImages: false,
              },
              forumThreadTags: [],
              mentions: null,
              placeholderLimits: null,
            },
          },
        ],
      },
    };

    await feedEventHandler.handleV2Event(event);

    feedFetcherService.fetchWithGrpc = async () => ({
      requestStatus: FeedResponseRequestStatus.Success,
      body: addArticleToFeed(feedText, {
        guid: "new-article",
      }),
      bodyHash: "bodyhash",
    });

    const results = await feedEventHandler.handleV2Event(event);
    deepStrictEqual(results?.length, 1);
  });
});

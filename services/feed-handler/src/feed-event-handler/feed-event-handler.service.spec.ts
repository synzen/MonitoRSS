import { Test, TestingModule } from "@nestjs/testing";
import { Article, FeedV2Event, MediumKey } from "../shared";
import { ArticlesService } from "../articles/articles.service";
import { FeedFetcherService } from "../feed-fetcher/feed-fetcher.service";
import { FeedEventHandlerService } from "./feed-event-handler.service";
import { ArticleRateLimitService } from "../article-rate-limit/article-rate-limit.service";

describe("FeedEventHandlerService", () => {
  let service: FeedEventHandlerService;
  const articlesService = {
    getArticlesToDeliverFromXml: jest.fn(),
  };
  const feedFetcherService = {
    fetch: jest.fn(),
  };
  const articleRateLimitService = {
    addOrUpdateFeedLimit: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.spyOn(console, "log").mockImplementation();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedEventHandlerService,
        {
          provide: ArticlesService,
          useValue: articlesService,
        },
        {
          provide: FeedFetcherService,
          useValue: feedFetcherService,
        },
        {
          provide: ArticleRateLimitService,
          useValue: articleRateLimitService,
        },
      ],
    }).compile();

    service = module.get<FeedEventHandlerService>(FeedEventHandlerService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("handleV2Event", () => {
    const v2Event: FeedV2Event = {
      feed: {
        id: "1",
        blockingComparisons: ["title"],
        passingComparisons: ["description"],
        url: "url",
      },
      mediums: [
        {
          key: MediumKey.Discord,
          details: {
            guildId: "1",
            channel: { id: "channel 1" },
            webhook: null,
          },
        },
      ],
      articleDayLimit: 100,
    };

    describe("schema validation", () => {
      it("throws if there is not at least one medium", async () => {
        await expect(
          service.handleV2Event({
            ...v2Event,
            mediums: [],
          })
        ).rejects.toThrow();
      });

      it("throws if there is not a recognized medium key", async () => {
        await expect(
          service.handleV2Event({
            ...v2Event,
            mediums: [
              {
                key: "invalid medium key" as MediumKey,
                details: {} as never,
              },
            ],
          })
        ).rejects.toThrow();
      });

      it("throws if feed properties are missing", async () => {
        await expect(
          service.handleV2Event({
            ...v2Event,
            feed: {
              url: "url",
            } as never,
          })
        ).rejects.toThrow();
      });
    });

    describe("when no feed request is pending", () => {
      it("returns no articles", async () => {
        feedFetcherService.fetch.mockResolvedValue(null);

        const returned = await service.handleV2Event(v2Event);
        expect(returned).toEqual([]);
      });
    });

    describe("when feed request succeeded but there are no articles", () => {
      it("returns no articles", async () => {
        feedFetcherService.fetch.mockResolvedValue("feed text");
        articlesService.getArticlesToDeliverFromXml.mockResolvedValue([]);

        const returned = await service.handleV2Event(v2Event);
        expect(returned).toEqual([]);
      });
    });

    describe("when there are no articles to deliver", () => {
      const articles: Article[] = [
        {
          id: "1",
        },
        {
          id: "2",
        },
      ];

      beforeEach(() => {
        feedFetcherService.fetch.mockResolvedValue("feed xml");
        articlesService.getArticlesToDeliverFromXml.mockResolvedValue(articles);
      });

      it("returns the articles to deliver", async () => {
        const returned = await service.handleV2Event(v2Event);
        expect(returned).toEqual(articles);
      });
    });
  });
});

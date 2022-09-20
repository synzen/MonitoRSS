import { Test, TestingModule } from "@nestjs/testing";
import { Article, FeedV2Event, MediumKey } from "../shared";
import { ArticlesService } from "../articles/articles.service";
import { FeedFetcherService } from "../feed-fetcher/feed-fetcher.service";
import { FeedEventHandlerService } from "./feed-event-handler.service";

describe("FeedEventHandlerService", () => {
  let service: FeedEventHandlerService;
  const articlesService = {
    getArticlesFromXml: jest.fn(),
    hasPriorArticlesStored: jest.fn(),
    storeArticles: jest.fn(),
    filterForNewArticles: jest.fn(),
    areComparisonsStored: jest.fn(),
    articleFieldsSeenBefore: jest.fn(),
  };
  const feedFetcherService = {
    fetch: jest.fn(),
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
        articlesService.getArticlesFromXml.mockResolvedValue({ articles: [] });

        const returned = await service.handleV2Event(v2Event);
        expect(returned).toEqual([]);
      });
    });

    describe("when there are no prior articles stored", () => {
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
        articlesService.getArticlesFromXml.mockResolvedValue({ articles });
      });

      it("stores all the articles", async () => {
        await service.handleV2Event(v2Event);
        expect(articlesService.storeArticles).toHaveBeenCalledWith(
          v2Event.feed.id,
          articles,
          {
            comparisonFields: expect.arrayContaining([
              ...v2Event.feed.passingComparisons,
              ...v2Event.feed.blockingComparisons,
            ]),
          }
        );
      });

      it("returns no articles", async () => {
        const returned = await service.handleV2Event(v2Event);

        expect(returned).toEqual([]);
      });
    });

    describe("when there are new article IDs", () => {
      const event: FeedV2Event = {
        ...v2Event,
        feed: {
          ...v2Event.feed,
          passingComparisons: [],
          blockingComparisons: [],
        },
      };
      const articles: Article[] = [
        {
          id: "1",
        },
        {
          id: "2",
        },
        {
          id: "3",
        },
      ];
      const filteredNewArticles = [articles[1], articles[2]];

      beforeEach(() => {
        feedFetcherService.fetch.mockResolvedValue("feed xml");
        articlesService.getArticlesFromXml.mockResolvedValue({ articles });
        articlesService.hasPriorArticlesStored.mockResolvedValue(true);
        articlesService.filterForNewArticles.mockResolvedValue(
          filteredNewArticles
        );
        jest.spyOn(service, "checkBlockingComparisons").mockResolvedValue([]);
        jest.spyOn(service, "checkPassingComparisons").mockResolvedValue([]);
      });

      it("returns new articles that passed block and passing comparisons", async () => {
        const blockingComparisonsReturn: Article[] = [
          {
            id: "1",
          },
        ];
        const passingComparisonsReturn: Article[] = [
          {
            id: "2",
          },
        ];
        jest
          .spyOn(service, "checkBlockingComparisons")
          .mockResolvedValue(blockingComparisonsReturn);
        jest
          .spyOn(service, "checkPassingComparisons")
          .mockResolvedValue(passingComparisonsReturn);
        const returned = await service.handleV2Event(event);
        expect(returned).toHaveLength(2);
        expect(returned).toEqual(
          expect.arrayContaining(
            blockingComparisonsReturn.concat(passingComparisonsReturn)
          )
        );
      });

      it("stores the new articles", async () => {
        await service.handleV2Event(event);
        expect(articlesService.storeArticles).toHaveBeenCalledWith(
          event.feed.id,
          filteredNewArticles,
          {
            comparisonFields: expect.arrayContaining(
              event.feed.passingComparisons.concat(
                event.feed.blockingComparisons
              )
            ),
          }
        );
      });
    });
  });
});

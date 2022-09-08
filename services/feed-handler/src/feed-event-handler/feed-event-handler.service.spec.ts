import { Test, TestingModule } from "@nestjs/testing";
import { Article } from "../shared/types";
import { ArticlesService } from "../articles/articles.service";
import { FeedFetcherService } from "../feed-fetcher/feed-fetcher.service";
import { FeedEventHandlerService } from "./feed-event-handler.service";
import { FeedV2Event } from "./types";

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
      id: "1",
      blockingComparisons: ["title"],
      passingComparisons: ["description"],
      url: "url",
    };

    describe("when no feed request is pending", () => {
      it("returns no articles", async () => {
        feedFetcherService.fetch.mockResolvedValue(null);

        const returned = await service.handleV2Event(v2Event);
        expect(returned).toEqual([]);
      });
    });

    describe("when feed request succeeded but there are no articles", () => {
      it("returns no articles", async () => {
        feedFetcherService.fetch.mockResolvedValue([]);

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
          v2Event.id,
          articles,
          {
            comparisonFields: expect.arrayContaining([
              ...v2Event.passingComparisons,
              ...v2Event.blockingComparisons,
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
        passingComparisons: [],
        blockingComparisons: [],
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
          event.id,
          filteredNewArticles,
          {
            comparisonFields: expect.arrayContaining(
              event.passingComparisons.concat(event.blockingComparisons)
            ),
          }
        );
      });
    });
  });
});

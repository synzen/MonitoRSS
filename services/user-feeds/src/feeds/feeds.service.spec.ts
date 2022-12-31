import { Test, TestingModule } from "@nestjs/testing";
import { ArticleFiltersService } from "../article-filters/article-filters.service";
import { ArticleRateLimitService } from "../article-rate-limit/article-rate-limit.service";
import { GetUserFeedArticlesFilterReturnType } from "./constants";
import { FeedsService } from "./feeds.service";
import { QueryForArticlesInput } from "./types";

describe("FeedsService", () => {
  let service: FeedsService;
  const articleRateLimitService = {
    getFeedLimitInformation: jest.fn(),
    addOrUpdateFeedLimit: jest.fn(),
  };
  const articleFiltersService = {
    getFilterExpressionErrors: jest.fn(),
    evaluateExpression: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedsService,
        {
          provide: ArticleRateLimitService,
          useValue: articleRateLimitService,
        },
        {
          provide: ArticleFiltersService,
          useValue: articleFiltersService,
        },
      ],
    }).compile();

    service = module.get<FeedsService>(FeedsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getRateLimitInformation", () => {
    it("returns the limits", async () => {
      const returnedInfo = [
        {
          remaining: 1,
        },
      ];
      articleRateLimitService.getFeedLimitInformation.mockResolvedValue(
        returnedInfo
      );

      const result = await service.getRateLimitInformation("feed-id");
      expect(result).toEqual(returnedInfo);
    });
  });

  describe("initializeFeed", () => {
    it("adds a feed limit", async () => {
      const addOrUpdateFeedLimit = jest.fn();
      articleRateLimitService.addOrUpdateFeedLimit = addOrUpdateFeedLimit;

      await service.initializeFeed("feed-id", {
        rateLimit: {
          limit: 1,
          timeWindowSec: 86400,
        },
      });
      expect(addOrUpdateFeedLimit).toHaveBeenCalledWith("feed-id", {
        limit: 1,
        timeWindowSec: 86400,
      });
    });
  });

  describe("getFilterExpressionErrors", () => {
    it("returns errors", async () => {
      const errors = ["error"];
      articleFiltersService.getFilterExpressionErrors.mockResolvedValue(errors);

      const result = await service.getFilterExpressionErrors({});
      expect(result).toEqual(errors);
    });
  });

  describe("queryForArticles", () => {
    const articles = [
      {
        id: "1",
        title: "title1",
        description: "description1",
      },
      {
        id: "2",
        title: "title2",
        description: "description2",
      },
      {
        id: "3",
        title: "title3",
        description: "description3",
      },
    ];
    const sampleInput: QueryForArticlesInput = {
      articles,
      limit: 1,
      random: false,
      skip: 0,
      selectProperties: ["id"],
    };

    it("respects limit", async () => {
      const input = {
        ...sampleInput,
        limit: 2,
        skip: 0,
      };

      const result = await service.queryForArticles(input);

      expect(result.articles.length).toEqual(2);

      expect(result.articles[0].id).toEqual("1");
      expect(result.articles[1].id).toEqual("2");
    });

    it("respects skip", async () => {
      const input = {
        ...sampleInput,
        skip: 1,
        limit: sampleInput.articles.length,
      };

      const result = await service.queryForArticles(input);

      expect(result.articles.length).toEqual(2);
      expect(result.articles[0].id).toEqual("2");
      expect(result.articles[1].id).toEqual("3");
    });

    it("respects combination of skip and limit", async () => {
      const input = {
        ...sampleInput,
        skip: 1,
        limit: 1,
      };

      const result = await service.queryForArticles(input);

      expect(result.articles.length).toEqual(1);
      expect(result.articles[0].id).toEqual("2");
    });

    it("returns only the input properties if input properties exist", async () => {
      const input: QueryForArticlesInput = {
        ...sampleInput,
        selectProperties: ["title"],
        limit: articles.length,
      };

      const result = await service.queryForArticles(input);
      const expected = [
        {
          title: "title1",
        },
        {
          title: "title2",
        },
        {
          title: "title3",
        },
      ];

      expect(result.articles).toEqual(expected);
      expect(result.properties).toEqual(["title"]);
    });

    it("returns the default id and title property if no input properties exist", async () => {
      const input: QueryForArticlesInput = {
        ...sampleInput,
        selectProperties: [],
        limit: articles.length,
      };

      const result = await service.queryForArticles(input);
      const expected = [
        {
          id: "1",
          title: "title1",
        },
        {
          id: "2",
          title: "title2",
        },
        {
          id: "3",
          title: "title3",
        },
      ];

      expect(result.articles).toEqual(expected);
      expect(result.properties).toEqual(["id", "title"]);
    });

    it(
      "returns the default id property if input" +
        "properties are empty and title is empty",
      async () => {
        const input: QueryForArticlesInput = {
          ...sampleInput,
          selectProperties: [],
          limit: articles.length,
          articles: sampleInput.articles.map((article) => ({
            id: article.id,
          })),
        };

        const result = await service.queryForArticles(input);
        const expected = [
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

        expect(result.articles).toEqual(expected);
        expect(result.properties).toEqual(["id"]);
      }
    );

    it("returns filter evaluationn results correctly", async () => {
      const input: QueryForArticlesInput = {
        ...sampleInput,
        filters: {
          expression: {},
          returnType:
            GetUserFeedArticlesFilterReturnType.IncludeEvaluationResults,
        },
        limit: articles.length,
      };

      jest
        .spyOn(articleFiltersService, "evaluateExpression")
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true);

      const result = await service.queryForArticles(input);

      expect(result.filterEvalResults).toEqual([
        {
          passed: true,
        },
        {
          passed: false,
        },
        {
          passed: true,
        },
      ]);
    });
  });
});

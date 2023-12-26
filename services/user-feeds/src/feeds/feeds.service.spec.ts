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
    buildReferences: jest.fn(),
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
        flattened: {
          id: "1",
          idHash: "1-hash",
          title: "title1",
          description: "description1",
        },
        raw: {} as never,
      },
      {
        flattened: {
          id: "2",
          idHash: "2-hash",
          title: "title2",
          description: "description2",
        },
        raw: {} as never,
      },
      {
        flattened: {
          id: "3",
          idHash: "3-hash",
          title: "title3",
          description: "description3",
        },
        raw: {} as never,
      },
    ];
    const sampleInput: QueryForArticlesInput = {
      articles,
      limit: 1,
      random: false,
      skip: 0,
      selectProperties: ["id"],
      customPlaceholders: [],
    };

    it("returns properly when there are 0 articles", async () => {
      const input: QueryForArticlesInput = {
        ...sampleInput,
        articles: [],
      };

      const result = await service.queryForArticles(input);

      expect(result).toMatchObject({
        articles: [],
        properties: input.selectProperties,
        totalArticles: 0,
        filterEvalResults: [],
      });
    });

    it("respects limit", async () => {
      const input = {
        ...sampleInput,
        limit: 2,
        skip: 0,
      };

      const result = await service.queryForArticles(input);

      expect(result.articles.length).toEqual(2);

      expect(result.articles[0].flattened.id).toEqual("1");
      expect(result.articles[1].flattened.id).toEqual("2");
      expect(result.totalArticles).toEqual(input.articles.length);
    });

    it("respects skip", async () => {
      const input = {
        ...sampleInput,
        skip: 1,
        limit: sampleInput.articles.length,
      };

      const result = await service.queryForArticles(input);

      expect(result.articles.length).toEqual(2);
      expect(result.articles[0].flattened.id).toEqual("2");
      expect(result.articles[1].flattened.id).toEqual("3");
      expect(result.totalArticles).toEqual(input.articles.length);
    });

    it("respects combination of skip and limit", async () => {
      const input = {
        ...sampleInput,
        skip: 1,
        limit: 1,
      };

      const result = await service.queryForArticles(input);

      expect(result.articles.length).toEqual(1);
      expect(result.articles[0].flattened.id).toEqual("2");
      expect(result.totalArticles).toEqual(input.articles.length);
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
          flattened: {
            id: "1",
            title: "title1",
          },
          raw: {},
        },
        {
          flattened: {
            id: "2",
            title: "title2",
          },
          raw: {},
        },
        {
          flattened: {
            id: "3",
            title: "title3",
          },
          raw: {},
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
          flattened: {
            id: "1",
            title: "title1",
          },
          raw: {},
        },
        {
          flattened: {
            id: "2",
            title: "title2",
          },
          raw: {},
        },
        {
          flattened: {
            id: "3",
            title: "title3",
          },
          raw: {},
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
            flattened: {
              id: article.flattened.id,
              idHash: `hash-${article.flattened.id}`,
            },
            raw: {} as never,
          })),
        };

        const result = await service.queryForArticles(input);
        const expected = [
          {
            flattened: {
              id: "1",
            },
            raw: {},
          },
          {
            flattened: {
              id: "2",
            },
            raw: {},
          },
          {
            flattened: {
              id: "3",
            },
            raw: {},
          },
        ];

        expect(result.articles).toEqual(expected);
        expect(result.properties).toEqual(["id"]);
      }
    );

    it("returns every property if asterisk is passed in properties", async () => {
      const input: QueryForArticlesInput = {
        ...sampleInput,
        articles: [
          {
            flattened: {
              id: "1",
              idHash: "1-hash",
              title: "title1",
              description: "description1",
            },
            raw: {} as never,
          },
          {
            flattened: {
              id: "2",
              idHash: "2-hash",
              title: "title2",
              description: "description2",
              author: "author2",
            },
            raw: {} as never,
          },
          {
            flattened: {
              id: "3",
              idHash: "3-hash",
              title: "title3",
              description: "description3",
              image: "image3",
            },
            raw: {} as never,
          },
        ],
        selectProperties: ["*"],
        limit: articles.length,
      };

      const result = await service.queryForArticles(input);
      const expected = [
        {
          flattened: {
            id: "1",
            title: "title1",
            description: "description1",
            author: "",
            image: "",
          },
          raw: {},
        },
        {
          flattened: {
            id: "2",
            title: "title2",
            description: "description2",
            author: "author2",
            image: "",
          },
          raw: {},
        },
        {
          flattened: {
            id: "3",
            title: "title3",
            description: "description3",
            author: "",
            image: "image3",
          },
          raw: {},
        },
      ];

      expect(result.properties).toEqual([
        "id",
        "title",
        "description",
        "author",
        "image",
      ]);
      expect(result.articles).toEqual(expected);
    });

    it("returns filter evaluation results correctly", async () => {
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

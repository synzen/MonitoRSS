import { Test, TestingModule } from "@nestjs/testing";
import { ArticleFiltersService } from "../article-filters/article-filters.service";
import { ArticleRateLimitService } from "../article-rate-limit/article-rate-limit.service";
import { FeedsService } from "./feeds.service";
import { QueryForArticlesInput } from "./types";
import { describe, beforeEach, it, mock } from "node:test";
import { deepEqual } from "node:assert";

describe("FeedsService", () => {
  let service: FeedsService;
  const articleRateLimitService = {
    getFeedLimitInformation: mock.fn(),
    addOrUpdateFeedLimit: mock.fn(),
  };
  const articleFiltersService = {
    getFilterExpressionErrors: mock.fn(() => [] as string[]),
    evaluateExpression: mock.fn(() => ({ result: false })),
    buildReferences: mock.fn(),
  };

  beforeEach(async () => {
    mock.reset();
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
    deepEqual(typeof service, "object");
  });

  describe("getFilterExpressionErrors", () => {
    it("returns errors", async () => {
      const errors = ["error"];

      articleFiltersService.getFilterExpressionErrors.mock.mockImplementationOnce(
        () => errors
      );

      const result = await service.getFilterExpressionErrors({});
      deepEqual(result, errors);
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

      deepEqual(result.articles, []);
      deepEqual(result.properties, input.selectProperties);
      deepEqual(result.totalArticles, 0);
      deepEqual(result.filterEvalResults, []);
    });

    it("respects limit", async () => {
      const input = {
        ...sampleInput,
        limit: 2,
        skip: 0,
      };

      const result = await service.queryForArticles(input);

      deepEqual(result.articles.length, 2);
      deepEqual(result.articles[0].flattened.id, "1");
      deepEqual(result.articles[1].flattened.id, "2");
      deepEqual(result.totalArticles, input.articles.length);
    });

    it("respects skip", async () => {
      const input = {
        ...sampleInput,
        skip: 1,
        limit: sampleInput.articles.length,
      };

      const result = await service.queryForArticles(input);

      deepEqual(result.articles.length, 2);
      deepEqual(result.articles[0].flattened.id, "2");
      deepEqual(result.articles[1].flattened.id, "3");
      deepEqual(result.totalArticles, input.articles.length);
    });

    it("respects combination of skip and limit", async () => {
      const input = {
        ...sampleInput,
        skip: 1,
        limit: 1,
      };

      const result = await service.queryForArticles(input);

      deepEqual(result.articles.length, 1);
      deepEqual(result.articles[0].flattened.id, "2");
      deepEqual(result.totalArticles, input.articles.length);
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
            idHash: "1-hash",
            title: "title1",
          },
          raw: {},
        },
        {
          flattened: {
            id: "2",
            idHash: "2-hash",
            title: "title2",
          },
          raw: {},
        },
        {
          flattened: {
            id: "3",
            idHash: "3-hash",
            title: "title3",
          },
          raw: {},
        },
      ];

      deepEqual(result.articles, expected);
      deepEqual(result.properties, ["title"]);
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
            idHash: "1-hash",
            title: "title1",
          },
          raw: {},
        },
        {
          flattened: {
            id: "2",
            idHash: "2-hash",
            title: "title2",
          },
          raw: {},
        },
        {
          flattened: {
            id: "3",
            idHash: "3-hash",
            title: "title3",
          },
          raw: {},
        },
      ];

      deepEqual(result.articles, expected);
      deepEqual(result.properties, ["id", "title"]);
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
              idHash: "hash-1",
            },
            raw: {},
          },
          {
            flattened: {
              id: "2",
              idHash: "hash-2",
            },
            raw: {},
          },
          {
            flattened: {
              id: "3",
              idHash: "hash-3",
            },
            raw: {},
          },
        ];

        deepEqual(result.articles, expected);
        deepEqual(result.properties, ["id"]);
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
            idHash: "1-hash",
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
            idHash: "2-hash",
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
            idHash: "3-hash",
            title: "title3",
            description: "description3",
            author: "",
            image: "image3",
          },
          raw: {},
        },
      ];

      deepEqual(result.properties, [
        "id",
        "idHash",
        "title",
        "description",
        "author",
        "image",
      ]);
      deepEqual(result.articles, expected);
    });
  });
});

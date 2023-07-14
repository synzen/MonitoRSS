import {
  clearDatabase,
  setupIntegrationTests,
  teardownIntegrationTests,
} from "../shared/utils/setup-integration-tests";
import { ArticlesService } from "./articles.service";
import { FeedArticleCustomComparison, FeedArticleField } from "./entities";
import { EntityManager, EntityRepository } from "@mikro-orm/core";
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { InvalidFeedException } from "./exceptions";
import { Article } from "../shared/types";
import { ArticleParserService } from "../article-parser/article-parser.service";

const feedId = "feed-id";

const feedText = readFileSync(
  join(__dirname, "..", "..", "test", "data", "rss-2-feed.xml"),
  "utf-8"
);

const emptyFeed = readFileSync(
  join(__dirname, "..", "..", "test", "data", "empty-feed.xml"),
  "utf-8"
);

const invalidFeed = readFileSync(
  join(__dirname, "..", "..", "test", "data", "invalid-feed.xml"),
  "utf-8"
);

describe("ArticlesService", () => {
  let service: ArticlesService;
  let articleFieldRepo: EntityRepository<FeedArticleField>;
  let articleCustomComparisonRepo: EntityRepository<FeedArticleCustomComparison>;
  const articleParserService = {
    flatten: jest.fn(),
  };

  beforeAll(async () => {
    const { init } = await setupIntegrationTests(
      {
        providers: [
          ArticlesService,
          {
            provide: ArticleParserService,
            useValue: articleParserService,
          },
        ],
      },
      {
        models: [FeedArticleField, FeedArticleCustomComparison],
      }
    );

    const { module } = await init();

    service = module.get<ArticlesService>(ArticlesService);
    const em = module.get(EntityManager);
    articleFieldRepo = em.getRepository(FeedArticleField);
    articleCustomComparisonRepo = em.getRepository(FeedArticleCustomComparison);
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    articleParserService.flatten.mockReturnValue({
      flattened: {},
    });
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getArticlesToDeliverFromXml", () => {
    const feedDetails = {
      id: feedId,
      passingComparisons: ["pass-1"],
      blockingComparisons: ["block-1"],
      formatOptions: {
        dateFormat: undefined,
        dateTimezone: undefined,
      },
    };

    it("returns empty array if there are no articles in xml", async () => {
      jest
        .spyOn(service, "getArticlesFromXml")
        .mockResolvedValue({ articles: [] });

      const articles = await service.getArticlesToDeliverFromXml(
        feedText,
        feedDetails
      );

      expect(articles).toHaveLength(0);
    });

    it("stores the new articles if they were not stored before", async () => {
      const articlesFromXml = [
        {
          flattened: {
            id: randomUUID(),
          },
          raw: {} as never,
        },
      ];
      jest.spyOn(service, "getArticlesFromXml").mockResolvedValue({
        articles: articlesFromXml,
      });
      jest.spyOn(service, "hasPriorArticlesStored").mockResolvedValue(false);
      const storeArticles = jest
        .spyOn(service, "storeArticles")
        .mockImplementation();

      const articlesToDeliver = await service.getArticlesToDeliverFromXml(
        feedText,
        feedDetails
      );

      expect(storeArticles).toHaveBeenCalledTimes(1);
      expect(storeArticles).toHaveBeenCalledWith(feedId, articlesFromXml, {
        comparisonFields: expect.arrayContaining(["pass-1", "block-1"]),
      });
      // This is an entirely new feed with no prior articles stored, so initialize the DB instead
      expect(articlesToDeliver).toHaveLength(0);
    });

    it("stores the new articles if some were previosuly stored, and returns them", async () => {
      const articlesFromXml = [
        {
          flattened: {
            id: "article id",
          },
          raw: {} as never,
        },
        {
          flattened: {
            id: "article id 2",
          },
          raw: {} as never,
        },
      ];
      jest.spyOn(service, "getArticlesFromXml").mockResolvedValue({
        articles: articlesFromXml,
      });
      jest.spyOn(service, "hasPriorArticlesStored").mockResolvedValue(true);
      const storeArticles = jest
        .spyOn(service, "storeArticles")
        .mockImplementation();

      jest.spyOn(service, "filterForNewArticles").mockResolvedValue([
        {
          flattened: {
            id: articlesFromXml[1].flattened.id,
          },
          raw: {} as never,
        },
      ]);

      jest.spyOn(service, "checkBlockingComparisons").mockResolvedValue([]);
      jest
        .spyOn(service, "checkPassingComparisons")
        .mockResolvedValue([articlesFromXml[1]]);

      const articlesToDeliver = await service.getArticlesToDeliverFromXml(
        feedText,
        feedDetails
      );

      expect(storeArticles).toHaveBeenCalledWith(feedId, [articlesFromXml[1]], {
        comparisonFields: [],
        skipIdStorage: true,
      });
      expect(articlesToDeliver).toHaveLength(1);
      expect(articlesToDeliver[0].flattened.id).toEqual(
        articlesFromXml[1].flattened.id
      );
    });

    it("returns the new articles in reverse order", async () => {
      const articlesFromXml = [
        {
          flattened: {
            id: "article id",
          },
          raw: {} as never,
        },
        {
          flattened: {
            id: "article id 2",
          },
          raw: {} as never,
        },
      ];
      jest.spyOn(service, "getArticlesFromXml").mockResolvedValue({
        articles: articlesFromXml,
      });
      jest.spyOn(service, "hasPriorArticlesStored").mockResolvedValue(true);

      jest.spyOn(service, "filterForNewArticles").mockResolvedValue([
        {
          flattened: {
            id: articlesFromXml[1].flattened.id,
          },
          raw: {} as never,
        },
      ]);

      jest
        .spyOn(service, "checkBlockingComparisons")
        .mockResolvedValue([articlesFromXml[0]]);
      jest
        .spyOn(service, "checkPassingComparisons")
        .mockResolvedValue([articlesFromXml[1]]);

      const articlesToDeliver = await service.getArticlesToDeliverFromXml(
        feedText,
        feedDetails
      );

      expect(articlesToDeliver).toHaveLength(2);
      expect(articlesToDeliver[0].flattened.id).toEqual(
        articlesFromXml[1].flattened.id
      );
      expect(articlesToDeliver[1].flattened.id).toEqual(
        articlesFromXml[0].flattened.id
      );
    });
  });

  describe("hasPriorArticlesStored", () => {
    it("returns true correctly", async () => {
      const feedId = randomUUID();

      await articleFieldRepo.nativeInsert({
        feed_id: feedId,
        field_name: "field-name",
        field_value: "field-value",
        created_at: new Date(),
      });

      const result = await service.hasPriorArticlesStored(feedId);
      expect(result).toEqual(true);
    });

    it("returns false correctly", async () => {
      await expect(
        service.hasPriorArticlesStored(randomUUID())
      ).resolves.toEqual(false);
    });
  });

  describe("getArticlesFromXml", () => {
    const options = {
      formatOptions: {
        dateFormat: undefined,
        dateTimezone: undefined,
      },
    };

    it("returns no articles for an empty feed", async () => {
      const result = await service.getArticlesFromXml(emptyFeed, options);

      expect(result.articles).toHaveLength(0);
    });
    it("returns the articles", async () => {
      const result = await service.getArticlesFromXml(feedText, options);

      expect(result.articles).toHaveLength(28);
    });

    it("adds id to every article", async () => {
      const result = await service.getArticlesFromXml(feedText, options);

      const ids = result.articles.map(({ flattened }) => flattened.id);

      expect(ids.every((id) => typeof id === "string")).toEqual(true);
      expect(ids.every((id) => id.length > 0)).toEqual(true);
    });

    it("rejects if it is an invalid feed", async () => {
      await expect(
        service.getArticlesFromXml(invalidFeed, {
          formatOptions: {
            dateFormat: undefined,
            dateTimezone: undefined,
          },
        })
      ).rejects.toThrow(InvalidFeedException);
    });
  });

  describe("storeArticles", () => {
    it("stores all the article ids", async () => {
      const feedId = "feed-id";
      const articles: Article[] = [
        {
          flattened: {
            id: "id-1",
          },
          raw: {} as never,
        },
        {
          flattened: {
            id: "id-2",
          },
          raw: {} as never,
        },
      ];

      await service.storeArticles(feedId, articles);

      const found = await articleFieldRepo.findAll();
      const fieldValues = found.map((f) => f.field_value);
      expect(fieldValues).toHaveLength(2);
      expect(fieldValues).toEqual(
        expect.arrayContaining(articles.map((a) => a.flattened.id))
      );
    });

    it("stores custom comparisons", async () => {
      const feedId = "feed-id";
      const articles: Article[] = [
        {
          flattened: {
            id: "id-1",
            title: "foo",
          },
          raw: {} as never,
        },
        {
          flattened: {
            id: "id-2",
            title: "bar",
          },
          raw: {} as never,
        },
        {
          flattened: {
            id: "id-2",
          },
          raw: {} as never,
        },
      ];

      await service.storeArticles(feedId, articles, {
        comparisonFields: ["title"],
      });

      const found = await articleFieldRepo.findAll();
      expect(found).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            feed_id: feedId,
            field_name: "title",
            field_value: articles[0].flattened.title,
          }),
          expect.objectContaining({
            feed_id: feedId,
            field_name: "title",
            field_value: articles[1].flattened.title,
          }),
        ])
      );
    });

    it("stores stored custom comparison fields", async () => {
      const feedId = "feed-id";
      const articles: Article[] = [
        {
          flattened: {
            id: "id-1",
            title: "foo",
            description: "bar",
          },
          raw: {} as never,
        },
        {
          flattened: {
            id: "id-2",
            title: "bar",
          },
          raw: {} as never,
        },
        {
          flattened: {
            id: "id-2",
          },
          raw: {} as never,
        },
      ];

      await service.storeArticles(feedId, articles, {
        comparisonFields: ["title", "description"],
      });

      const found = await articleCustomComparisonRepo.findAll();
      expect(found).toHaveLength(2);
      expect(found).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(Number),
            feed_id: feedId,
            field_name: "title",
          }),
          expect.objectContaining({
            id: expect.any(Number),
            feed_id: feedId,
            field_name: "description",
          }),
        ])
      );
    });

    it("does not insert duplicate custom comparison fields", async () => {
      const feedId = "feed-id";
      const articles: Article[] = [
        {
          flattened: {
            id: "id-1",
            title: "foo",
            description: "bar",
          },
          raw: {} as never,
        },
        {
          flattened: {
            id: "id-2",
            title: "bar",
          },
          raw: {} as never,
        },
        {
          flattened: {
            id: "id-2",
          },
          raw: {} as never,
        },
      ];

      await articleCustomComparisonRepo.nativeInsert({
        feed_id: feedId,
        field_name: "title",
        id: 100,
        created_at: new Date(),
      });

      await service.storeArticles(feedId, articles, {
        comparisonFields: ["title", "description"],
      });

      const found = await articleCustomComparisonRepo.findAll();
      const fields = found.map((f) => f.field_name);
      expect(fields).toHaveLength(2);
      expect(fields).toEqual(expect.arrayContaining(["title", "description"]));
    });
  });

  describe("filterForNewArtileIds", () => {
    it("returns the article IDs that are not stored", async () => {
      const feedId = "feed-id";

      await Promise.all([
        articleFieldRepo.nativeInsert({
          id: 1,
          feed_id: feedId,
          field_name: "id",
          field_value: "1",
          created_at: new Date(),
        }),
        articleFieldRepo.nativeInsert({
          id: 2,
          feed_id: feedId,
          field_name: "id",
          field_value: "2",
          created_at: new Date(),
        }),
      ]);

      const articles = ["1", "2", "3", "4"].map((id) => ({
        flattened: {
          id,
        },
        raw: {} as never,
      }));

      const newArticles = await service.filterForNewArticles(feedId, articles);

      expect(newArticles).toEqual([
        { flattened: { id: "3" }, raw: {} as never },
        { flattened: { id: "4" }, raw: {} as never },
      ]);
    });
  });

  describe("areComparisonsStored", () => {
    it("returns the correct results", async () => {
      const feedId = "feed-id";

      await articleCustomComparisonRepo.nativeInsert({
        feed_id: feedId,
        field_name: "title",
        id: 1,
        created_at: new Date(),
      });

      const result = await service.areComparisonsStored(feedId, [
        "title",
        "description",
      ]);
      expect(result).toEqual([
        { field: "title", isStored: true },
        { field: "description", isStored: false },
      ]);
    });
  });

  describe("articleFieldsSeenBefore", () => {
    it("returns true if some fields were seen before", async () => {
      await articleFieldRepo.nativeInsert({
        feed_id: feedId,
        created_at: new Date(),
        field_name: "title",
        field_value: "foobar",
      });
      await articleFieldRepo.nativeInsert({
        feed_id: feedId,
        created_at: new Date(),
        field_name: "description",
        field_value: "foobaz",
      });

      const article: Article = {
        flattened: { id: "1", title: "foobar", description: "baz" },
        raw: {} as never,
      };

      const result = await service.articleFieldsSeenBefore(feedId, article, [
        "title",
        "description",
      ]);
      expect(result).toEqual(true);
    });

    it("returns false if fields were not seen before", async () => {
      await articleFieldRepo.nativeInsert({
        feed_id: feedId,
        created_at: new Date(),
        field_name: "title",
        field_value: "foobar",
      });
      await articleFieldRepo.nativeInsert({
        feed_id: feedId,
        created_at: new Date(),
        field_name: "description",
        field_value: "foobaz",
      });

      const article: Article = {
        flattened: { id: "1", title: "title", description: "baz" },
        raw: {} as never,
      };

      const result = await service.articleFieldsSeenBefore(feedId, article, [
        "title",
        "description",
      ]);
      expect(result).toEqual(false);
    });

    it("returns false if article fields do not exist on article", async () => {
      await articleFieldRepo.nativeInsert({
        feed_id: feedId,
        created_at: new Date(),
        field_name: "title",
        field_value: "foobar",
      });

      const article: Article = {
        flattened: { id: "1", author: "hi" },
        raw: {} as never,
      };

      const result = await service.articleFieldsSeenBefore(feedId, article, [
        "title",
      ]);
      expect(result).toEqual(false);
    });
  });

  describe("checkPassingComparisons", () => {
    const feed = {
      id: "feed-id",
      passingComparisons: ["title"],
    };
    const articles = [
      { flattened: { id: "1", title: "foo" }, raw: {} as never },
      { flattened: { id: "2", title: "bar" }, raw: {} as never },
    ];

    it("returns an empty array if there were no seen articles", async () => {
      const result = await service.checkPassingComparisons(feed, [], ["title"]);
      expect(result).toEqual([]);
    });

    it("returns an empty array if there are no passing comparisons", async () => {
      const result = await service.checkPassingComparisons(
        { ...feed, passingComparisons: [] },
        articles,
        []
      );
      expect(result).toEqual([]);
    });

    it("does not return any articles if the comparisons were not stored", async () => {
      const result = await service.checkPassingComparisons(feed, articles, []);
      expect(result).toEqual([]);
    });

    it("only returns the articles whose values were not seen before", async () => {
      await articleFieldRepo.nativeInsert({
        feed_id: feed.id,
        created_at: new Date(),
        field_name: "title",
        field_value: "foo",
      });

      await articleCustomComparisonRepo.nativeInsert({
        field_name: "title",
        feed_id: feed.id,
        created_at: new Date(),
      });

      const result = await service.checkPassingComparisons(feed, articles, [
        "title",
      ]);
      expect(result).toEqual([articles[1]]);
    });
  });

  describe("deleteInfoForFeed", () => {
    it("deletes article field entities", async () => {
      await articleFieldRepo.nativeInsert({
        feed_id: feedId,
        created_at: new Date(),
        field_name: "title",
        field_value: "foobar",
      });
      await articleFieldRepo.nativeInsert({
        feed_id: feedId,
        created_at: new Date(),
        field_name: "description",
        field_value: "foobaz",
      });

      await service.deleteInfoForFeed(feedId);

      const fields = await articleFieldRepo.findAll();
      expect(fields).toHaveLength(0);
    });

    it("deletes article custom comparison entities", async () => {
      await articleCustomComparisonRepo.nativeInsert({
        feed_id: feedId,
        field_name: "title",
        id: 1,
        created_at: new Date(),
      });
      await articleCustomComparisonRepo.nativeInsert({
        feed_id: feedId,
        field_name: "description",
        id: 2,
        created_at: new Date(),
      });

      await service.deleteInfoForFeed(feedId);

      const fields = await articleCustomComparisonRepo.findAll();
      expect(fields).toHaveLength(0);
    });
  });
});

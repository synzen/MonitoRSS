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
  let storedCustomComparisonsRepo: EntityRepository<FeedArticleCustomComparison>;

  beforeAll(async () => {
    const { init } = await setupIntegrationTests(
      {
        providers: [ArticlesService],
      },
      {
        models: [FeedArticleField, FeedArticleCustomComparison],
      }
    );

    const { module } = await init();

    service = module.get<ArticlesService>(ArticlesService);
    const em = module.get(EntityManager);
    articleFieldRepo = em.getRepository(FeedArticleField);
    storedCustomComparisonsRepo = em.getRepository(FeedArticleCustomComparison);
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
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
    it("returns no articles for an empty feed", async () => {
      const result = await service.getArticlesFromXml(emptyFeed);

      expect(result.articles).toHaveLength(0);
    });
    it("returns the articles", async () => {
      const result = await service.getArticlesFromXml(feedText);

      expect(result.articles).toHaveLength(28);
    });

    it("adds id to every article", async () => {
      const result = await service.getArticlesFromXml(feedText);

      const ids = result.articles.map(({ id }) => id);

      expect(ids.every((id) => typeof id === "string")).toEqual(true);
      expect(ids.every((id) => id.length > 0)).toEqual(true);
    });

    it("rejects if it is an invalid feed", async () => {
      await expect(service.getArticlesFromXml(invalidFeed)).rejects.toThrow(
        InvalidFeedException
      );
    });
  });

  describe("storeArticles", () => {
    it("stores all the article ids", async () => {
      const feedId = "feed-id";
      const articles: Article[] = [
        {
          id: "id-1",
        },
        {
          id: "id-2",
        },
      ];

      await service.storeArticles(feedId, articles);

      const found = await articleFieldRepo.findAll();
      const fieldValues = found.map((f) => f.field_value);
      expect(fieldValues).toHaveLength(2);
      expect(fieldValues).toEqual(
        expect.arrayContaining(articles.map((a) => a.id))
      );
    });

    it("stores custom comparisons", async () => {
      const feedId = "feed-id";
      const articles: Article[] = [
        {
          id: "id-1",
          title: "foo",
        },
        {
          id: "id-2",
          title: "bar",
        },
        {
          id: "id-2",
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
            field_value: articles[0].title,
          }),
          expect.objectContaining({
            feed_id: feedId,
            field_name: "title",
            field_value: articles[1].title,
          }),
        ])
      );
    });

    it("stores stored custom comparison fields", async () => {
      const feedId = "feed-id";
      const articles: Article[] = [
        {
          id: "id-1",
          title: "foo",
          description: "bar",
        },
        {
          id: "id-2",
          title: "bar",
        },
        {
          id: "id-2",
        },
      ];

      await service.storeArticles(feedId, articles, {
        comparisonFields: ["title", "description"],
      });

      const found = await storedCustomComparisonsRepo.findAll();
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
          id: "id-1",
          title: "foo",
          description: "bar",
        },
        {
          id: "id-2",
          title: "bar",
        },
        {
          id: "id-2",
        },
      ];

      await storedCustomComparisonsRepo.nativeInsert({
        feed_id: feedId,
        field_name: "title",
        id: 100,
        created_at: new Date(),
      });

      await service.storeArticles(feedId, articles, {
        comparisonFields: ["title", "description"],
      });

      const found = await storedCustomComparisonsRepo.findAll();
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
        id,
      }));

      const newArticles = await service.filterForNewArticles(feedId, articles);

      expect(newArticles).toEqual([{ id: "3" }, { id: "4" }]);
    });
  });

  describe("areComparisonsStored", () => {
    it("returns the correct results", async () => {
      const feedId = "feed-id";

      await storedCustomComparisonsRepo.nativeInsert({
        feed_id: feedId,
        field_name: "title",
        id: 1,
        created_at: new Date(),
      });

      const result = await service.areComparisonsStored(feedId, [
        "title",
        "description",
      ]);
      expect(result).toEqual([true, false]);
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

      const article: Article = { id: "1", title: "foobar", description: "baz" };

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

      const article: Article = { id: "1", title: "title", description: "baz" };

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

      const article: Article = { id: "1", author: "hi" };

      const result = await service.articleFieldsSeenBefore(feedId, article, [
        "title",
      ]);
      expect(result).toEqual(false);
    });
  });
});

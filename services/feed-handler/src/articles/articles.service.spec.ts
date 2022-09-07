import {
  setupIntegrationTests,
  teardownIntegrationTests,
} from "../shared/utils/setup-integration-tests";
import { ArticlesService } from "./articles.service";
import { FeedArticleField } from "./entities";
import { EntityManager, EntityRepository } from "@mikro-orm/core";
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { InvalidFeedException } from "./exceptions";
import { Article } from "./types";

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

  beforeAll(async () => {
    const { init } = await setupIntegrationTests(
      {
        providers: [ArticlesService],
      },
      {
        models: [FeedArticleField],
      }
    );

    const { module } = await init();

    service = module.get<ArticlesService>(ArticlesService);
    const em = module.get(EntityManager);
    articleFieldRepo = em.getRepository(FeedArticleField);
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
  });
});

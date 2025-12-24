import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
  calculateCacheKeyForArticles,
  doFeedArticlesExistInCache,
  getFeedArticlesFromCache,
  setFeedArticlesInCache,
  updateFeedArticlesInCache,
  invalidateFeedArticlesCache,
  refreshFeedArticlesCacheExpiration,
  clearInMemoryParsedArticlesCache,
  inMemoryParsedArticlesCacheStore,
} from "./parsed-articles-cache";
import type {
  CacheKeyOptions,
  CachedArticles,
} from "../interfaces/parsed-articles-cache";
import type { Article } from "../../articles/parser";

function createArticle(
  id: string,
  fields: Record<string, string> = {}
): Article {
  return {
    flattened: {
      id,
      idHash: `hash-${id}`,
      ...fields,
    },
    raw: {},
  };
}

describe("parsed-articles-cache", { concurrency: true }, () => {
  beforeEach(() => {
    clearInMemoryParsedArticlesCache();
  });

  describe("calculateCacheKeyForArticles", () => {
    it("generates consistent keys for the same URL and options", () => {
      const params = {
        url: "https://example.com/feed.xml",
        options: {
          formatOptions: {
            dateFormat: "YYYY-MM-DD",
            dateTimezone: "UTC",
          },
        },
      };

      const key1 = calculateCacheKeyForArticles(params);
      const key2 = calculateCacheKeyForArticles(params);

      assert.strictEqual(key1, key2);
      assert.ok(/^articles:com:[a-f0-9]{40}$/.test(key1));
    });

    it("generates different keys for different URLs", () => {
      const options: CacheKeyOptions = {
        formatOptions: {},
      };

      const key1 = calculateCacheKeyForArticles({
        url: "https://example.com/feed1.xml",
        options,
      });

      const key2 = calculateCacheKeyForArticles({
        url: "https://example.com/feed2.xml",
        options,
      });

      assert.notStrictEqual(key1, key2);
    });

    it("generates different keys for different format options", () => {
      const url = "https://example.com/feed.xml";

      const key1 = calculateCacheKeyForArticles({
        url,
        options: { formatOptions: { dateFormat: "YYYY-MM-DD" } },
      });

      const key2 = calculateCacheKeyForArticles({
        url,
        options: { formatOptions: { dateFormat: "DD/MM/YYYY" } },
      });

      assert.notStrictEqual(key1, key2);
    });

    it("normalizes empty format options", () => {
      const url = "https://example.com/feed.xml";

      // Empty formatOptions should be stripped out
      const key1 = calculateCacheKeyForArticles({
        url,
        options: { formatOptions: {} },
      });

      const key2 = calculateCacheKeyForArticles({
        url,
        options: {
          formatOptions: {
            dateFormat: undefined,
            dateTimezone: undefined,
          },
        },
      });

      assert.strictEqual(key1, key2);
    });

    it("includes external feed properties in key", () => {
      const url = "https://example.com/feed.xml";

      const key1 = calculateCacheKeyForArticles({
        url,
        options: { formatOptions: {} },
      });

      const key2 = calculateCacheKeyForArticles({
        url,
        options: {
          formatOptions: {},
          externalFeedProperties: [
            { sourceField: "link", cssSelector: ".content", label: "content" },
          ],
        },
      });

      assert.notStrictEqual(key1, key2);
    });

    it("includes request lookup details key in cache key", () => {
      const url = "https://example.com/feed.xml";

      const key1 = calculateCacheKeyForArticles({
        url,
        options: { formatOptions: {} },
      });

      const key2 = calculateCacheKeyForArticles({
        url,
        options: {
          formatOptions: {},
          requestLookupDetails: { key: "lookup-123" },
        },
      });

      assert.notStrictEqual(key1, key2);
    });
  });

  describe("inMemoryParsedArticlesCacheStore", () => {
    const store = inMemoryParsedArticlesCacheStore;

    it("returns false for non-existent key", async () => {
      assert.strictEqual(await store.exists("nonexistent"), false);
    });

    it("returns null for non-existent key", async () => {
      assert.strictEqual(await store.get("nonexistent"), null);
    });

    it("stores and retrieves a value", async () => {
      await store.set("test-key", "test-value", { expSeconds: 60 });

      assert.strictEqual(await store.exists("test-key"), true);
      assert.strictEqual(await store.get("test-key"), "test-value");
    });

    it("deletes a value", async () => {
      await store.set("test-key", "test-value", { expSeconds: 60 });
      await store.del("test-key");

      assert.strictEqual(await store.exists("test-key"), false);
    });

    it("returns TTL for a key", async () => {
      await store.set("test-key", "test-value", { expSeconds: 60 });

      const ttl = await store.ttl("test-key");
      assert.ok(ttl > 0);
      assert.ok(ttl <= 60);
    });

    it("returns -1 TTL for non-existent key", async () => {
      const ttl = await store.ttl("nonexistent");
      assert.strictEqual(ttl, -1);
    });

    it("preserves old TTL when useOldTTL is true", async () => {
      // Set with 100 second TTL
      await store.set("test-key", "value1", { expSeconds: 100 });

      // Wait a moment
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Update with useOldTTL
      await store.set("test-key", "value2", {
        expSeconds: 10,
        useOldTTL: true,
      });

      // TTL should still be close to 100, not 10
      const ttl = await store.ttl("test-key");
      assert.ok(ttl > 50);
    });

    it("updates expiration with expire", async () => {
      await store.set("test-key", "test-value", { expSeconds: 10 });
      await store.expire("test-key", 100);

      const ttl = await store.ttl("test-key");
      assert.ok(ttl > 50);
    });
  });

  describe("cache operations", () => {
    const store = inMemoryParsedArticlesCacheStore;
    const testParams = {
      url: "https://example.com/feed.xml",
      options: { formatOptions: {} } as CacheKeyOptions,
    };

    it("doFeedArticlesExistInCache returns false when not cached", async () => {
      assert.strictEqual(await doFeedArticlesExistInCache(store, testParams), false);
    });

    it("setFeedArticlesInCache stores and getFeedArticlesFromCache retrieves", async () => {
      const articles = [createArticle("1"), createArticle("2")];

      await setFeedArticlesInCache(store, {
        ...testParams,
        data: { articles },
      });

      const cached = await getFeedArticlesFromCache(store, testParams);

      assert.notStrictEqual(cached, null);
      assert.strictEqual(cached!.articles.length, 2);
      assert.strictEqual(cached!.articles[0]!.flattened.id, "1");
    });

    it("doFeedArticlesExistInCache returns true after caching", async () => {
      await setFeedArticlesInCache(store, {
        ...testParams,
        data: { articles: [createArticle("1")] },
      });

      assert.strictEqual(await doFeedArticlesExistInCache(store, testParams), true);
    });

    it("invalidateFeedArticlesCache removes cached articles", async () => {
      await setFeedArticlesInCache(store, {
        ...testParams,
        data: { articles: [createArticle("1")] },
      });

      await invalidateFeedArticlesCache(store, testParams);

      assert.strictEqual(await doFeedArticlesExistInCache(store, testParams), false);
    });

    it("refreshFeedArticlesCacheExpiration updates TTL", async () => {
      await setFeedArticlesInCache(store, {
        ...testParams,
        data: { articles: [createArticle("1")] },
      });

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      await refreshFeedArticlesCacheExpiration(store, testParams);

      // Should still exist and have a fresh TTL
      assert.strictEqual(await doFeedArticlesExistInCache(store, testParams), true);
    });

    it("compresses and decompresses data correctly", async () => {
      const articles = [
        createArticle("1", { title: "Article with special chars: <>&\"'" }),
        createArticle("2", { description: "Long description ".repeat(100) }),
      ];

      await setFeedArticlesInCache(store, {
        ...testParams,
        data: { articles },
      });

      const cached = await getFeedArticlesFromCache(store, testParams);

      assert.notStrictEqual(cached, null);
      assert.strictEqual(cached!.articles[0]!.flattened.title, "Article with special chars: <>&\"'");
      assert.strictEqual(cached!.articles[1]!.flattened.description, "Long description ".repeat(100));
    });
  });

  describe("updateFeedArticlesInCache", () => {
    const store = inMemoryParsedArticlesCacheStore;
    const testParams = {
      url: "https://example.com/feed.xml",
      options: { formatOptions: {} } as CacheKeyOptions,
    };

    it("does nothing when articles are not cached", async () => {
      // Should not throw
      await updateFeedArticlesInCache(store, {
        ...testParams,
        articles: [createArticle("1")],
      });

      // Still should not exist
      assert.strictEqual(await doFeedArticlesExistInCache(store, testParams), false);
    });

    it("updates cached articles when they exist", async () => {
      // First cache some articles
      await setFeedArticlesInCache(store, {
        ...testParams,
        data: { articles: [createArticle("1")] },
      });

      // Update with new articles
      await updateFeedArticlesInCache(store, {
        ...testParams,
        articles: [createArticle("1"), createArticle("2")],
      });

      // Should have updated articles
      const cached = await getFeedArticlesFromCache(store, testParams);
      assert.strictEqual(cached!.articles.length, 2);
    });

    it("preserves TTL when updating", async () => {
      // Cache with a specific TTL (we'll use the default 300s)
      await setFeedArticlesInCache(store, {
        ...testParams,
        data: { articles: [createArticle("1")] },
      });

      const ttlBefore = await store.ttl(
        calculateCacheKeyForArticles(testParams)
      );

      // Wait a moment
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Update
      await updateFeedArticlesInCache(store, {
        ...testParams,
        articles: [createArticle("2")],
      });

      const ttlAfter = await store.ttl(
        calculateCacheKeyForArticles(testParams)
      );

      // TTL should be close to before (within a few seconds)
      assert.ok(Math.abs(ttlAfter - ttlBefore) < 5);
    });
  });
});

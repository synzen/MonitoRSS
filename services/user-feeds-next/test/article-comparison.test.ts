import { describe, expect, it, beforeEach } from "bun:test";
import {
  getArticlesToDeliver,
  inMemoryArticleFieldStore,
  clearInMemoryStore,
  type ArticleFieldStore,
} from "../src/article-comparison";
import type { Article } from "../src/article-parser";

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

describe("article-comparison", () => {
  beforeEach(() => {
    clearInMemoryStore();
  });

  /**
   * Helper to create a mock store with configurable behavior.
   */
  function createMockStore(config: {
    hasPriorArticles: boolean;
    hotPartitionIds: Set<string>;
    coldPartitionIds: Set<string>;
    storedComparisonNames?: Set<string>;
  }): ArticleFieldStore & {
    storedArticles: Article[][];
    comparisonNames: Set<string>;
  } {
    const storedArticles: Article[][] = [];
    const comparisonNames: Set<string> =
      config.storedComparisonNames ?? new Set();

    return {
      storedArticles,
      comparisonNames,
      hasPriorArticlesStored: async () => config.hasPriorArticles,
      findStoredArticleIds: async (_feedId, idHashes) => {
        // Return all IDs that are in either partition
        const allIds = new Set([
          ...config.hotPartitionIds,
          ...config.coldPartitionIds,
        ]);
        return new Set(idHashes.filter((id) => allIds.has(id)));
      },
      findStoredArticleIdsPartitioned: async (
        _feedId,
        idHashes,
        olderThanOneMonth
      ) => {
        const partition = olderThanOneMonth
          ? config.coldPartitionIds
          : config.hotPartitionIds;
        return new Set(idHashes.filter((id) => partition.has(id)));
      },
      someFieldsExist: async () => false,
      storeArticles: async (_feedId, articles, _comparisonFields) => {
        storedArticles.push(articles);
      },
      getStoredComparisonNames: async () => comparisonNames,
      storeComparisonNames: async (_feedId, names) => {
        for (const name of names) {
          comparisonNames.add(name);
        }
      },
      clear: async () => {},
    };
  }

  describe("getArticlesToDeliver", () => {
    it("delivers nothing on first run (stores articles)", async () => {
      const articles = [
        createArticle("1", { title: "Article 1" }),
        createArticle("2", { title: "Article 2" }),
      ];

      const result = await getArticlesToDeliver(
        inMemoryArticleFieldStore,
        "feed-1",
        articles,
        { blockingComparisons: [], passingComparisons: [] }
      );

      expect(result.articlesToDeliver.length).toBe(0);
    });

    it("delivers new articles on subsequent runs", async () => {
      // First run - stores articles
      await getArticlesToDeliver(
        inMemoryArticleFieldStore,
        "feed-1",
        [createArticle("1", { title: "Article 1" })],
        { blockingComparisons: [], passingComparisons: [] }
      );

      // Second run - new article should be delivered
      const result = await getArticlesToDeliver(
        inMemoryArticleFieldStore,
        "feed-1",
        [
          createArticle("1", { title: "Article 1" }),
          createArticle("2", { title: "Article 2" }),
        ],
        { blockingComparisons: [], passingComparisons: [] }
      );

      expect(result.articlesToDeliver.length).toBe(1);
      expect(result.articlesToDeliver[0]!.flattened.id).toBe("2");
    });

    it("blocks articles with seen blocking comparison fields", async () => {
      // First run
      await getArticlesToDeliver(
        inMemoryArticleFieldStore,
        "feed-1",
        [createArticle("1", { title: "Same Title" })],
        { blockingComparisons: ["title"], passingComparisons: [] }
      );

      // Second run - new ID but same title should be blocked
      const result = await getArticlesToDeliver(
        inMemoryArticleFieldStore,
        "feed-1",
        [
          createArticle("1", { title: "Same Title" }),
          createArticle("2", { title: "Same Title" }), // Same title as article 1
        ],
        { blockingComparisons: ["title"], passingComparisons: [] }
      );

      expect(result.articlesToDeliver.length).toBe(0);
      expect(result.articlesBlocked.length).toBe(1);
    });

    it("passes articles with changed passing comparison fields", async () => {
      // First run
      await getArticlesToDeliver(
        inMemoryArticleFieldStore,
        "feed-1",
        [createArticle("1", { title: "Original Title" })],
        { blockingComparisons: [], passingComparisons: ["title"] }
      );

      // Second run - same ID but different title should pass
      const result = await getArticlesToDeliver(
        inMemoryArticleFieldStore,
        "feed-1",
        [createArticle("1", { title: "Updated Title" })],
        { blockingComparisons: [], passingComparisons: ["title"] }
      );

      expect(result.articlesToDeliver.length).toBe(1);
      expect(result.articlesPassed.length).toBe(1);
    });

    it("does not deliver seen articles with unchanged passing comparisons", async () => {
      // First run
      await getArticlesToDeliver(
        inMemoryArticleFieldStore,
        "feed-1",
        [createArticle("1", { title: "Same Title" })],
        { blockingComparisons: [], passingComparisons: ["title"] }
      );

      // Second run - same ID and same title should not deliver
      const result = await getArticlesToDeliver(
        inMemoryArticleFieldStore,
        "feed-1",
        [createArticle("1", { title: "Same Title" })],
        { blockingComparisons: [], passingComparisons: ["title"] }
      );

      expect(result.articlesToDeliver.length).toBe(0);
    });

    it("isolates articles by feed ID", async () => {
      // Store article for feed-1
      await getArticlesToDeliver(
        inMemoryArticleFieldStore,
        "feed-1",
        [createArticle("1", { title: "Article 1" })],
        { blockingComparisons: [], passingComparisons: [] }
      );

      // Same article ID for feed-2 should be new
      const result = await getArticlesToDeliver(
        inMemoryArticleFieldStore,
        "feed-2",
        [createArticle("1", { title: "Article 1" })],
        { blockingComparisons: [], passingComparisons: [] }
      );

      // First run for feed-2, so nothing delivered
      expect(result.articlesToDeliver.length).toBe(0);
    });
  });

  describe("two-pass partitioned filtering", () => {
    /**
     * These tests use a mock store to verify the two-pass filtering logic:
     * - First pass checks "hot" partition (articles stored within past month)
     * - Second pass checks "cold" partition (articles stored older than 1 month)
     * - Articles in cold partition are re-stored with fresh timestamps
     */

    it("returns new articles not in any partition", async () => {
      const mockStore = createMockStore({
        hasPriorArticles: true,
        hotPartitionIds: new Set(["hash-1"]),
        coldPartitionIds: new Set(),
      });

      const articles = [
        createArticle("1"), // in hot partition
        createArticle("2"), // not stored
      ];

      const result = await getArticlesToDeliver(mockStore, "feed-1", articles, {
        blockingComparisons: [],
        passingComparisons: [],
      });

      expect(result.articlesToDeliver.length).toBe(1);
      expect(result.articlesToDeliver[0]!.flattened.id).toBe("2");
    });

    it("does not deliver articles in hot partition", async () => {
      const mockStore = createMockStore({
        hasPriorArticles: true,
        hotPartitionIds: new Set(["hash-1", "hash-2"]),
        coldPartitionIds: new Set(),
      });

      const articles = [createArticle("1"), createArticle("2")];

      const result = await getArticlesToDeliver(mockStore, "feed-1", articles, {
        blockingComparisons: [],
        passingComparisons: [],
      });

      expect(result.articlesToDeliver.length).toBe(0);
    });

    it("does not deliver articles in cold partition", async () => {
      const mockStore = createMockStore({
        hasPriorArticles: true,
        hotPartitionIds: new Set(),
        coldPartitionIds: new Set(["hash-1"]),
      });

      const articles = [createArticle("1")];

      const result = await getArticlesToDeliver(mockStore, "feed-1", articles, {
        blockingComparisons: [],
        passingComparisons: [],
      });

      expect(result.articlesToDeliver.length).toBe(0);
    });

    it("re-stores cold partition articles with fresh timestamp", async () => {
      const mockStore = createMockStore({
        hasPriorArticles: true,
        hotPartitionIds: new Set(),
        coldPartitionIds: new Set(["hash-1"]),
      });

      const articles = [
        createArticle("1"), // in cold partition
        createArticle("2"), // not stored (new)
      ];

      await getArticlesToDeliver(mockStore, "feed-1", articles, {
        blockingComparisons: [],
        passingComparisons: [],
      });

      // Should have 2 storeArticles calls:
      // 1. New articles [article-2] with comparison fields
      // 2. Cold partition articles [article-1] with empty comparison fields (ID only)
      expect(mockStore.storedArticles.length).toBe(2);

      // First call stores new articles
      expect(mockStore.storedArticles[0]!.length).toBe(1);
      expect(mockStore.storedArticles[0]![0]!.flattened.id).toBe("2");

      // Second call re-stores cold partition articles
      expect(mockStore.storedArticles[1]!.length).toBe(1);
      expect(mockStore.storedArticles[1]![0]!.flattened.id).toBe("1");
    });

    it("handles mixed hot and cold partitions correctly", async () => {
      const mockStore = createMockStore({
        hasPriorArticles: true,
        hotPartitionIds: new Set(["hash-1"]),
        coldPartitionIds: new Set(["hash-2"]),
      });

      const articles = [
        createArticle("1"), // in hot partition
        createArticle("2"), // in cold partition
        createArticle("3"), // not stored (new)
      ];

      const result = await getArticlesToDeliver(mockStore, "feed-1", articles, {
        blockingComparisons: [],
        passingComparisons: [],
      });

      // Only article-3 should be delivered
      expect(result.articlesToDeliver.length).toBe(1);
      expect(result.articlesToDeliver[0]!.flattened.id).toBe("3");

      // Should re-store article-2 from cold partition
      expect(mockStore.storedArticles.length).toBe(2);
      expect(mockStore.storedArticles[1]![0]!.flattened.id).toBe("2");
    });

    it("skips second pass when all articles are in hot partition", async () => {
      let partitionedCalls = 0;
      const mockStore = createMockStore({
        hasPriorArticles: true,
        hotPartitionIds: new Set(["hash-1", "hash-2"]),
        coldPartitionIds: new Set(),
      });

      // Override to count calls
      const originalFn = mockStore.findStoredArticleIdsPartitioned;
      mockStore.findStoredArticleIdsPartitioned = async (...args) => {
        partitionedCalls++;
        return originalFn(...args);
      };

      const articles = [createArticle("1"), createArticle("2")];

      await getArticlesToDeliver(mockStore, "feed-1", articles, {
        blockingComparisons: [],
        passingComparisons: [],
      });

      // Only first pass needed since all in hot partition
      expect(partitionedCalls).toBe(1);
    });
  });

  describe("stored comparisons behavior", () => {
    /**
     * These tests verify that comparison fields are only used for blocking/passing
     * if they have been previously stored. This matches the behavior in user-feeds
     * where comparison fields are only "active" after they've been stored in the
     * FeedArticleCustomComparison table.
     */

    it("does not use a new blocking comparison until it has been stored", async () => {
      // First run - no prior articles, store articles with "author" comparison
      await getArticlesToDeliver(
        inMemoryArticleFieldStore,
        "comparison-feed-1",
        [createArticle("1", { author: "John" })],
        { blockingComparisons: ["author"], passingComparisons: [] }
      );

      // Second run - add a NEW blocking comparison "category" that wasn't stored yet
      // The article has a matching "author" but matching should be blocked since author was stored
      // The article also has a matching "category" but it won't be used because it's new
      const result = await getArticlesToDeliver(
        inMemoryArticleFieldStore,
        "comparison-feed-1",
        [
          createArticle("2", { author: "John", category: "Tech" }), // new article with matching author
        ],
        { blockingComparisons: ["author", "category"], passingComparisons: [] }
      );

      // Article 2 should be blocked because author matches (author was stored)
      // Even though category is a new comparison, it's now stored, so it won't affect this run
      expect(result.articlesBlocked.length).toBe(1);
      expect(result.articlesToDeliver.length).toBe(0);
    });

    it("uses blocking comparison after it has been stored", async () => {
      // First run - store articles with "author" comparison
      await getArticlesToDeliver(
        inMemoryArticleFieldStore,
        "comparison-feed-2",
        [createArticle("1", { author: "John" })],
        { blockingComparisons: ["author"], passingComparisons: [] }
      );

      // Second run - new article with different author should pass
      const result = await getArticlesToDeliver(
        inMemoryArticleFieldStore,
        "comparison-feed-2",
        [createArticle("2", { author: "Jane" })],
        { blockingComparisons: ["author"], passingComparisons: [] }
      );

      expect(result.articlesToDeliver.length).toBe(1);
      expect(result.articlesBlocked.length).toBe(0);
    });

    it("does not use a new passing comparison until it has been stored", async () => {
      const mockStore = createMockStore({
        hasPriorArticles: true,
        hotPartitionIds: new Set(["hash-1"]),
        coldPartitionIds: new Set(),
        storedComparisonNames: new Set(["title"]), // Only "title" is stored
      });

      // Override someFieldsExist to check if fields are different
      mockStore.someFieldsExist = async (_feedId, fields) => {
        // Simulate that "title" field value was NOT seen (so it should pass)
        // But "description" is a new comparison, shouldn't be checked
        for (const field of fields) {
          if (field.name === "title") {
            return false; // Title changed - should pass
          }
        }
        return false;
      };

      const articles = [
        createArticle("1", { title: "Updated Title", description: "New Desc" }),
      ];

      const result = await getArticlesToDeliver(mockStore, "feed-1", articles, {
        blockingComparisons: [],
        passingComparisons: ["title", "description"], // description is new
      });

      // Article should pass based on title alone (description is new, not used)
      expect(result.articlesPassed.length).toBe(1);
      expect(result.articlesToDeliver.length).toBe(1);
    });

    it("stores comparison names when articles are stored", async () => {
      const mockStore = createMockStore({
        hasPriorArticles: false,
        hotPartitionIds: new Set(),
        coldPartitionIds: new Set(),
      });

      await getArticlesToDeliver(mockStore, "feed-1", [createArticle("1")], {
        blockingComparisons: ["field1"],
        passingComparisons: ["field2"],
      });

      // Both comparison names should be stored
      expect(mockStore.comparisonNames.has("field1")).toBe(true);
      expect(mockStore.comparisonNames.has("field2")).toBe(true);
    });
  });
});

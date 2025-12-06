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
      startContext: async <T>(cb: () => Promise<T>) => cb(),
      flushPendingInserts: async () => ({ affectedRows: 0 }),
    };
  }

  describe("getArticlesToDeliver", () => {
    it("delivers nothing on first run (stores articles)", async () => {
      await inMemoryArticleFieldStore.startContext(async () => {
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
        await inMemoryArticleFieldStore.flushPendingInserts();
      });
    });

    it("delivers new articles on subsequent runs", async () => {
      await inMemoryArticleFieldStore.startContext(async () => {
        // First run - stores articles
        await getArticlesToDeliver(
          inMemoryArticleFieldStore,
          "feed-1",
          [createArticle("1", { title: "Article 1" })],
          { blockingComparisons: [], passingComparisons: [] }
        );
        await inMemoryArticleFieldStore.flushPendingInserts();

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
        await inMemoryArticleFieldStore.flushPendingInserts();

        expect(result.articlesToDeliver.length).toBe(1);
        expect(result.articlesToDeliver[0]!.flattened.id).toBe("2");
      });
    });

    it("blocks articles with seen blocking comparison fields", async () => {
      await inMemoryArticleFieldStore.startContext(async () => {
        // First run
        await getArticlesToDeliver(
          inMemoryArticleFieldStore,
          "feed-1",
          [createArticle("1", { title: "Same Title" })],
          { blockingComparisons: ["title"], passingComparisons: [] }
        );
        await inMemoryArticleFieldStore.flushPendingInserts();

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
        await inMemoryArticleFieldStore.flushPendingInserts();

        expect(result.articlesToDeliver.length).toBe(0);
        expect(result.articlesBlocked.length).toBe(1);
      });
    });

    it("passes articles with changed passing comparison fields", async () => {
      await inMemoryArticleFieldStore.startContext(async () => {
        // First run
        await getArticlesToDeliver(
          inMemoryArticleFieldStore,
          "feed-1",
          [createArticle("1", { title: "Original Title" })],
          { blockingComparisons: [], passingComparisons: ["title"] }
        );
        await inMemoryArticleFieldStore.flushPendingInserts();

        // Second run - same ID but different title should pass
        const result = await getArticlesToDeliver(
          inMemoryArticleFieldStore,
          "feed-1",
          [createArticle("1", { title: "Updated Title" })],
          { blockingComparisons: [], passingComparisons: ["title"] }
        );
        await inMemoryArticleFieldStore.flushPendingInserts();

        expect(result.articlesToDeliver.length).toBe(1);
        expect(result.articlesPassed.length).toBe(1);
      });
    });

    it("does not deliver seen articles with unchanged passing comparisons", async () => {
      await inMemoryArticleFieldStore.startContext(async () => {
        // First run
        await getArticlesToDeliver(
          inMemoryArticleFieldStore,
          "feed-1",
          [createArticle("1", { title: "Same Title" })],
          { blockingComparisons: [], passingComparisons: ["title"] }
        );
        await inMemoryArticleFieldStore.flushPendingInserts();

        // Second run - same ID and same title should not deliver
        const result = await getArticlesToDeliver(
          inMemoryArticleFieldStore,
          "feed-1",
          [createArticle("1", { title: "Same Title" })],
          { blockingComparisons: [], passingComparisons: ["title"] }
        );
        await inMemoryArticleFieldStore.flushPendingInserts();

        expect(result.articlesToDeliver.length).toBe(0);
      });
    });

    it("isolates articles by feed ID", async () => {
      await inMemoryArticleFieldStore.startContext(async () => {
        // Store article for feed-1
        await getArticlesToDeliver(
          inMemoryArticleFieldStore,
          "feed-1",
          [createArticle("1", { title: "Article 1" })],
          { blockingComparisons: [], passingComparisons: [] }
        );
        await inMemoryArticleFieldStore.flushPendingInserts();

        // Same article ID for feed-2 should be new
        const result = await getArticlesToDeliver(
          inMemoryArticleFieldStore,
          "feed-2",
          [createArticle("1", { title: "Article 1" })],
          { blockingComparisons: [], passingComparisons: [] }
        );
        await inMemoryArticleFieldStore.flushPendingInserts();

        // First run for feed-2, so nothing delivered
        expect(result.articlesToDeliver.length).toBe(0);
      });
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
      await inMemoryArticleFieldStore.startContext(async () => {
        // First run - no prior articles, store articles with "author" comparison
        await getArticlesToDeliver(
          inMemoryArticleFieldStore,
          "comparison-feed-1",
          [createArticle("1", { author: "John" })],
          { blockingComparisons: ["author"], passingComparisons: [] }
        );
        await inMemoryArticleFieldStore.flushPendingInserts();

        // Second run - add a NEW blocking comparison "category" that wasn't stored yet
        // The article has a matching "author" but matching should be blocked since author was stored
        // The article also has a matching "category" but it won't be used because it's new
        const result = await getArticlesToDeliver(
          inMemoryArticleFieldStore,
          "comparison-feed-1",
          [
            createArticle("2", { author: "John", category: "Tech" }), // new article with matching author
          ],
          {
            blockingComparisons: ["author", "category"],
            passingComparisons: [],
          }
        );
        await inMemoryArticleFieldStore.flushPendingInserts();

        // Article 2 should be blocked because author matches (author was stored)
        // Even though category is a new comparison, it's now stored, so it won't affect this run
        expect(result.articlesBlocked.length).toBe(1);
        expect(result.articlesToDeliver.length).toBe(0);
      });
    });

    it("uses blocking comparison after it has been stored", async () => {
      await inMemoryArticleFieldStore.startContext(async () => {
        // First run - store articles with "author" comparison
        await getArticlesToDeliver(
          inMemoryArticleFieldStore,
          "comparison-feed-2",
          [createArticle("1", { author: "John" })],
          { blockingComparisons: ["author"], passingComparisons: [] }
        );
        await inMemoryArticleFieldStore.flushPendingInserts();

        // Second run - new article with different author should pass
        const result = await getArticlesToDeliver(
          inMemoryArticleFieldStore,
          "comparison-feed-2",
          [createArticle("2", { author: "Jane" })],
          { blockingComparisons: ["author"], passingComparisons: [] }
        );
        await inMemoryArticleFieldStore.flushPendingInserts();

        expect(result.articlesToDeliver.length).toBe(1);
        expect(result.articlesBlocked.length).toBe(0);
      });
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

  describe("AsyncLocalStorage context", () => {
    it("batches inserts within startContext and flushes them", async () => {
      const articles = [
        createArticle("ctx-1", { title: "Context Article 1" }),
        createArticle("ctx-2", { title: "Context Article 2" }),
      ];

      await inMemoryArticleFieldStore.startContext(async () => {
        // Store articles within context (should be pending)
        await inMemoryArticleFieldStore.storeArticles("feed-ctx", articles, []);

        // Before flush, articles should NOT be visible (in pending state)
        // Note: The in-memory store accumulates in pendingInserts within context
        // and only moves to the actual store on flush

        // Flush pending inserts
        const result = await inMemoryArticleFieldStore.flushPendingInserts();
        expect(result.affectedRows).toBe(2); // 2 article IDs

        // After flush, articles should be visible
        const hasPrior =
          await inMemoryArticleFieldStore.hasPriorArticlesStored("feed-ctx");
        expect(hasPrior).toBe(true);
      });
    });

    it("throws when flushPendingInserts called without context", async () => {
      await expect(
        inMemoryArticleFieldStore.flushPendingInserts()
      ).rejects.toThrow("No context was started for ArticleFieldStore");
    });

    it("clears pending inserts after flush", async () => {
      const articles = [createArticle("flush-1")];

      await inMemoryArticleFieldStore.startContext(async () => {
        await inMemoryArticleFieldStore.storeArticles(
          "feed-flush",
          articles,
          []
        );

        // First flush should have affected rows
        const result1 = await inMemoryArticleFieldStore.flushPendingInserts();
        expect(result1.affectedRows).toBe(1);

        // Second flush should have no affected rows (buffer cleared)
        const result2 = await inMemoryArticleFieldStore.flushPendingInserts();
        expect(result2.affectedRows).toBe(0);
      });
    });

    it("throws when storeArticles called without context", async () => {
      const articles = [createArticle("no-ctx-1")];

      await expect(
        inMemoryArticleFieldStore.storeArticles("feed-no-ctx", articles, [])
      ).rejects.toThrow("No context was started for ArticleFieldStore");
    });

    it("includes comparison field inserts in affected rows count", async () => {
      const articles = [
        createArticle("fields-1", { title: "Title 1", author: "Author 1" }),
      ];

      await inMemoryArticleFieldStore.startContext(async () => {
        await inMemoryArticleFieldStore.storeArticles("feed-fields", articles, [
          "title",
          "author",
        ]);

        // Should flush: 1 article ID + 2 comparison fields = 3 inserts
        const result = await inMemoryArticleFieldStore.flushPendingInserts();
        expect(result.affectedRows).toBe(3);
      });
    });

    it("isolates contexts between concurrent operations", async () => {
      const articles1 = [createArticle("iso-1")];
      const articles2 = [createArticle("iso-2")];

      // Run two contexts concurrently
      const [result1, result2] = await Promise.all([
        inMemoryArticleFieldStore.startContext(async () => {
          await inMemoryArticleFieldStore.storeArticles(
            "feed-iso-1",
            articles1,
            []
          );
          return inMemoryArticleFieldStore.flushPendingInserts();
        }),
        inMemoryArticleFieldStore.startContext(async () => {
          await inMemoryArticleFieldStore.storeArticles(
            "feed-iso-2",
            articles2,
            []
          );
          return inMemoryArticleFieldStore.flushPendingInserts();
        }),
      ]);

      // Each context should have its own affected rows
      expect(result1.affectedRows).toBe(1);
      expect(result2.affectedRows).toBe(1);

      // Both feeds should have articles stored
      const hasPrior1 =
        await inMemoryArticleFieldStore.hasPriorArticlesStored("feed-iso-1");
      const hasPrior2 =
        await inMemoryArticleFieldStore.hasPriorArticlesStored("feed-iso-2");
      expect(hasPrior1).toBe(true);
      expect(hasPrior2).toBe(true);
    });
  });
});

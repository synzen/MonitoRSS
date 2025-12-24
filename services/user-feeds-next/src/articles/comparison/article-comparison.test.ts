import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
  getArticlesToDeliver,
  inMemoryArticleFieldStore,
  clearInMemoryStore,
  type ArticleFieldStore,
} from ".";
import type { Article } from "../parser";
import { DeliveryPreviewStage, DeliveryPreviewStageStatus, type DeliveryPreviewStageResult } from "../../delivery-preview";

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

describe("article-comparison", { concurrency: true }, () => {
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

        assert.strictEqual(result.articlesToDeliver.length, 0);
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

        assert.strictEqual(result.articlesToDeliver.length, 1);
        assert.strictEqual(result.articlesToDeliver[0]!.flattened.id, "2");
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

        assert.strictEqual(result.articlesToDeliver.length, 0);
        assert.strictEqual(result.articlesBlocked.length, 1);
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

        assert.strictEqual(result.articlesToDeliver.length, 1);
        assert.strictEqual(result.articlesPassed.length, 1);
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

        assert.strictEqual(result.articlesToDeliver.length, 0);
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
        assert.strictEqual(result.articlesToDeliver.length, 0);
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

      assert.strictEqual(result.articlesToDeliver.length, 1);
      assert.strictEqual(result.articlesToDeliver[0]!.flattened.id, "2");
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

      assert.strictEqual(result.articlesToDeliver.length, 0);
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

      assert.strictEqual(result.articlesToDeliver.length, 0);
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
      assert.strictEqual(mockStore.storedArticles.length, 2);

      // First call stores new articles
      assert.strictEqual(mockStore.storedArticles[0]!.length, 1);
      assert.strictEqual(mockStore.storedArticles[0]![0]!.flattened.id, "2");

      // Second call re-stores cold partition articles
      assert.strictEqual(mockStore.storedArticles[1]!.length, 1);
      assert.strictEqual(mockStore.storedArticles[1]![0]!.flattened.id, "1");
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
      assert.strictEqual(result.articlesToDeliver.length, 1);
      assert.strictEqual(result.articlesToDeliver[0]!.flattened.id, "3");

      // Should re-store article-2 from cold partition
      assert.strictEqual(mockStore.storedArticles.length, 2);
      assert.strictEqual(mockStore.storedArticles[1]![0]!.flattened.id, "2");
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
      assert.strictEqual(partitionedCalls, 1);
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
        assert.strictEqual(result.articlesBlocked.length, 1);
        assert.strictEqual(result.articlesToDeliver.length, 0);
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

        assert.strictEqual(result.articlesToDeliver.length, 1);
        assert.strictEqual(result.articlesBlocked.length, 0);
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
      assert.strictEqual(result.articlesPassed.length, 1);
      assert.strictEqual(result.articlesToDeliver.length, 1);
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
      assert.ok(mockStore.comparisonNames.has("field1"));
      assert.ok(mockStore.comparisonNames.has("field2"));
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
        assert.strictEqual(result.affectedRows, 2); // 2 article IDs

        // After flush, articles should be visible
        const hasPrior =
          await inMemoryArticleFieldStore.hasPriorArticlesStored("feed-ctx");
        assert.strictEqual(hasPrior, true);
      });
    });

    it("throws when flushPendingInserts called without context", async () => {
      await assert.rejects(
        inMemoryArticleFieldStore.flushPendingInserts(),
        { message: /No context was started for ArticleFieldStore/ }
      );
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
        assert.strictEqual(result1.affectedRows, 1);

        // Second flush should have no affected rows (buffer cleared)
        const result2 = await inMemoryArticleFieldStore.flushPendingInserts();
        assert.strictEqual(result2.affectedRows, 0);
      });
    });

    it("throws when storeArticles called without context", async () => {
      const articles = [createArticle("no-ctx-1")];

      await assert.rejects(
        inMemoryArticleFieldStore.storeArticles("feed-no-ctx", articles, []),
        { message: /No context was started for ArticleFieldStore/ }
      );
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
        assert.strictEqual(result.affectedRows, 3);
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
      assert.strictEqual(result1.affectedRows, 1);
      assert.strictEqual(result2.affectedRows, 1);

      // Both feeds should have articles stored
      const hasPrior1 =
        await inMemoryArticleFieldStore.hasPriorArticlesStored("feed-iso-1");
      const hasPrior2 =
        await inMemoryArticleFieldStore.hasPriorArticlesStored("feed-iso-2");
      assert.strictEqual(hasPrior1, true);
      assert.strictEqual(hasPrior2, true);
    });
  });

  describe("diagnostic recording", () => {
    it("records FeedState diagnostic on first run", async () => {
      const { startDeliveryPreviewContext, getDeliveryPreviewResultsForArticle } =
        await import("../../delivery-preview/delivery-preview-context");

      await inMemoryArticleFieldStore.startContext(async () => {
        let diagnostics: DeliveryPreviewStageResult[] = [];

        await startDeliveryPreviewContext("hash-1", async () => {
          await getArticlesToDeliver(
            inMemoryArticleFieldStore,
            "diag-feed-1",
            [createArticle("1", { title: "Test" })],
            { blockingComparisons: [], passingComparisons: [] }
          );
          diagnostics = getDeliveryPreviewResultsForArticle("hash-1");
        });

        assert.ok(diagnostics.length > 0);
        const feedState = diagnostics.find(
          (d) => d.stage === DeliveryPreviewStage.FeedState
        );
        assert.notStrictEqual(feedState, undefined);
        assert.strictEqual(
          (feedState as { details: { isFirstRun: boolean } }).details.isFirstRun,
          true
        );
        // First run records articles as baseline, status is Failed because articles won't be delivered
        assert.strictEqual(feedState!.status, DeliveryPreviewStageStatus.Failed);
      });
    });

    it("records IdComparison diagnostic for new articles", async () => {
      const { startDeliveryPreviewContext, getDeliveryPreviewResultsForArticle } =
        await import("../../delivery-preview/delivery-preview-context");

      await inMemoryArticleFieldStore.startContext(async () => {
        // First run to establish baseline
        await getArticlesToDeliver(
          inMemoryArticleFieldStore,
          "diag-feed-2",
          [createArticle("1", { title: "Article 1" })],
          { blockingComparisons: [], passingComparisons: [] }
        );
        await inMemoryArticleFieldStore.flushPendingInserts();

        let diagnostics: DeliveryPreviewStageResult[] = [];

        // Second run with diagnostic context for a new article
        await startDeliveryPreviewContext("hash-2", async () => {
          await getArticlesToDeliver(
            inMemoryArticleFieldStore,
            "diag-feed-2",
            [
              createArticle("1", { title: "Article 1" }),
              createArticle("2", { title: "Article 2" }),
            ],
            { blockingComparisons: [], passingComparisons: [] }
          );
          diagnostics = getDeliveryPreviewResultsForArticle("hash-2");
        });

        const idComparison = diagnostics.find(
          (d) => d.stage === DeliveryPreviewStage.IdComparison
        );
        assert.notStrictEqual(idComparison, undefined);
        assert.strictEqual(
          (idComparison as { details: { isNew: boolean } }).details.isNew,
          true
        );
      });
    });

    it("records BlockingComparison diagnostic when article is blocked", async () => {
      const { startDeliveryPreviewContext, getDeliveryPreviewResultsForArticle } =
        await import("../../delivery-preview/delivery-preview-context");

      await inMemoryArticleFieldStore.startContext(async () => {
        // First run
        await getArticlesToDeliver(
          inMemoryArticleFieldStore,
          "diag-feed-3",
          [createArticle("1", { title: "Same Title" })],
          { blockingComparisons: ["title"], passingComparisons: [] }
        );
        await inMemoryArticleFieldStore.flushPendingInserts();

        let diagnostics: DeliveryPreviewStageResult[] = [];

        // Second run with same title (should be blocked)
        await startDeliveryPreviewContext("hash-2", async () => {
          await getArticlesToDeliver(
            inMemoryArticleFieldStore,
            "diag-feed-3",
            [createArticle("2", { title: "Same Title" })],
            { blockingComparisons: ["title"], passingComparisons: [] }
          );
          diagnostics = getDeliveryPreviewResultsForArticle("hash-2");
        });

        const blockingComparison = diagnostics.find(
          (d) => d.stage === DeliveryPreviewStage.BlockingComparison
        );
        assert.notStrictEqual(blockingComparison, undefined);
        assert.strictEqual(blockingComparison!.status, DeliveryPreviewStageStatus.Failed);
        assert.ok(
          (
            blockingComparison as {
              details: { blockedByFields: string[] };
            }
          ).details.blockedByFields.includes("title")
        );
      });
    });

    it("records PassingComparison diagnostic when article passes", async () => {
      const { startDeliveryPreviewContext, getDeliveryPreviewResultsForArticle } =
        await import("../../delivery-preview/delivery-preview-context");

      await inMemoryArticleFieldStore.startContext(async () => {
        // First run
        await getArticlesToDeliver(
          inMemoryArticleFieldStore,
          "diag-feed-4",
          [createArticle("1", { title: "Original Title" })],
          { blockingComparisons: [], passingComparisons: ["title"] }
        );
        await inMemoryArticleFieldStore.flushPendingInserts();

        let diagnostics: DeliveryPreviewStageResult[] = [];

        // Second run with changed title (should pass)
        await startDeliveryPreviewContext("hash-1", async () => {
          await getArticlesToDeliver(
            inMemoryArticleFieldStore,
            "diag-feed-4",
            [createArticle("1", { title: "Updated Title" })],
            { blockingComparisons: [], passingComparisons: ["title"] }
          );
          diagnostics = getDeliveryPreviewResultsForArticle("hash-1");
        });

        const passingComparison = diagnostics.find(
          (d) => d.stage === DeliveryPreviewStage.PassingComparison
        );
        assert.notStrictEqual(passingComparison, undefined);
        assert.strictEqual(passingComparison!.status, DeliveryPreviewStageStatus.Passed);
        assert.ok(
          (
            passingComparison as {
              details: { changedFields: string[] };
            }
          ).details.changedFields.includes("title")
        );
      });
    });

    it("records DateCheck diagnostic when article is filtered by date", async () => {
      const { startDeliveryPreviewContext, getDeliveryPreviewResultsForArticle } =
        await import("../../delivery-preview/delivery-preview-context");

      await inMemoryArticleFieldStore.startContext(async () => {
        // First run to establish baseline
        await getArticlesToDeliver(
          inMemoryArticleFieldStore,
          "diag-feed-5",
          [createArticle("1")],
          { blockingComparisons: [], passingComparisons: [] }
        );
        await inMemoryArticleFieldStore.flushPendingInserts();

        let diagnostics: DeliveryPreviewStageResult[] = [];

        // Second run with old article date
        const oldDate = new Date(
          Date.now() - 1000 * 60 * 60 * 24 * 30
        ).toISOString(); // 30 days ago
        const articleWithOldDate: Article = {
          flattened: { id: "2", idHash: "hash-2", title: "Old Article" },
          raw: { date: oldDate },
        };

        await startDeliveryPreviewContext("hash-2", async () => {
          await getArticlesToDeliver(
            inMemoryArticleFieldStore,
            "diag-feed-5",
            [articleWithOldDate],
            {
              blockingComparisons: [],
              passingComparisons: [],
              dateChecks: {
                oldArticleDateDiffMsThreshold: 1000 * 60 * 60 * 24, // 1 day
              },
            }
          );
          diagnostics = getDeliveryPreviewResultsForArticle("hash-2");
        });

        const dateCheck = diagnostics.find(
          (d) => d.stage === DeliveryPreviewStage.DateCheck
        );
        assert.notStrictEqual(dateCheck, undefined);
        assert.strictEqual(dateCheck!.status, DeliveryPreviewStageStatus.Failed);
      });
    });

    it("does not record diagnostics outside diagnostic context", async () => {
      const { getAllDeliveryPreviewResults } = await import("../../delivery-preview/delivery-preview-context");

      await inMemoryArticleFieldStore.startContext(async () => {
        await getArticlesToDeliver(
          inMemoryArticleFieldStore,
          "diag-feed-6",
          [createArticle("1")],
          { blockingComparisons: [], passingComparisons: [] }
        );

        // Outside diagnostic context, should return empty Map
        const diagnostics = getAllDeliveryPreviewResults();
        assert.strictEqual(diagnostics.size, 0);
      });
    });
  });

  describe("multi-target diagnostic recording", () => {
    it("records FeedState diagnostic for all target articles", async () => {
      const {
        startDeliveryPreviewContext,
        getDeliveryPreviewResultsForArticle,
      } = await import("../../delivery-preview/delivery-preview-context");

      await inMemoryArticleFieldStore.startContext(async () => {
        const targetHashes = new Set(["hash-1", "hash-2"]);

        await startDeliveryPreviewContext(targetHashes, async () => {
          await getArticlesToDeliver(
            inMemoryArticleFieldStore,
            "multi-diag-feed-1",
            [
              createArticle("1", { title: "Article 1" }),
              createArticle("2", { title: "Article 2" }),
            ],
            { blockingComparisons: [], passingComparisons: [] }
          );

          // Both targets should have FeedState diagnostic
          const diag1 = getDeliveryPreviewResultsForArticle("hash-1");
          const diag2 = getDeliveryPreviewResultsForArticle("hash-2");

          const feedState1 = diag1.find(
            (d) => d.stage === DeliveryPreviewStage.FeedState
          );
          const feedState2 = diag2.find(
            (d) => d.stage === DeliveryPreviewStage.FeedState
          );

          assert.notStrictEqual(feedState1, undefined);
          assert.notStrictEqual(feedState2, undefined);
          assert.strictEqual(
            (feedState1 as { details: { isFirstRun: boolean } }).details
              .isFirstRun,
            true
          );
          assert.strictEqual(
            (feedState2 as { details: { isFirstRun: boolean } }).details
              .isFirstRun,
            true
          );
        });
      });
    });

    it("records IdComparison diagnostic for each target article", async () => {
      const {
        startDeliveryPreviewContext,
        getDeliveryPreviewResultsForArticle,
      } = await import("../../delivery-preview/delivery-preview-context");

      await inMemoryArticleFieldStore.startContext(async () => {
        // First run to establish baseline
        await getArticlesToDeliver(
          inMemoryArticleFieldStore,
          "multi-diag-feed-2",
          [createArticle("1", { title: "Article 1" })],
          { blockingComparisons: [], passingComparisons: [] }
        );
        await inMemoryArticleFieldStore.flushPendingInserts();

        const targetHashes = new Set(["hash-1", "hash-2"]);

        // Second run - hash-1 is seen, hash-2 is new
        await startDeliveryPreviewContext(targetHashes, async () => {
          await getArticlesToDeliver(
            inMemoryArticleFieldStore,
            "multi-diag-feed-2",
            [
              createArticle("1", { title: "Article 1" }),
              createArticle("2", { title: "Article 2" }),
            ],
            { blockingComparisons: [], passingComparisons: [] }
          );

          const diag1 = getDeliveryPreviewResultsForArticle("hash-1");
          const diag2 = getDeliveryPreviewResultsForArticle("hash-2");

          const idComp1 = diag1.find(
            (d) => d.stage === DeliveryPreviewStage.IdComparison
          );
          const idComp2 = diag2.find(
            (d) => d.stage === DeliveryPreviewStage.IdComparison
          );

          assert.notStrictEqual(idComp1, undefined);
          assert.notStrictEqual(idComp2, undefined);
          assert.strictEqual(
            (idComp1 as { details: { isNew: boolean } }).details.isNew,
            false
          ); // hash-1 was seen before
          assert.strictEqual(
            (idComp2 as { details: { isNew: boolean } }).details.isNew,
            true
          ); // hash-2 is new
        });
      });
    });

    it("records BlockingComparison for each new target article", async () => {
      const {
        startDeliveryPreviewContext,
        getDeliveryPreviewResultsForArticle,
      } = await import("../../delivery-preview/delivery-preview-context");

      await inMemoryArticleFieldStore.startContext(async () => {
        // First run
        await getArticlesToDeliver(
          inMemoryArticleFieldStore,
          "multi-diag-feed-3",
          [createArticle("1", { title: "Same Title" })],
          { blockingComparisons: ["title"], passingComparisons: [] }
        );
        await inMemoryArticleFieldStore.flushPendingInserts();

        const targetHashes = new Set(["hash-2", "hash-3"]);

        // Second run - both new articles with same title should be blocked
        await startDeliveryPreviewContext(targetHashes, async () => {
          await getArticlesToDeliver(
            inMemoryArticleFieldStore,
            "multi-diag-feed-3",
            [
              createArticle("2", { title: "Same Title" }),
              createArticle("3", { title: "Same Title" }),
            ],
            { blockingComparisons: ["title"], passingComparisons: [] }
          );

          const diag2 = getDeliveryPreviewResultsForArticle("hash-2");
          const diag3 = getDeliveryPreviewResultsForArticle("hash-3");

          const blocking2 = diag2.find(
            (d) => d.stage === DeliveryPreviewStage.BlockingComparison
          );
          const blocking3 = diag3.find(
            (d) => d.stage === DeliveryPreviewStage.BlockingComparison
          );

          assert.notStrictEqual(blocking2, undefined);
          assert.notStrictEqual(blocking3, undefined);
          assert.strictEqual(blocking2!.status, DeliveryPreviewStageStatus.Failed);
          assert.strictEqual(blocking3!.status, DeliveryPreviewStageStatus.Failed);
        });
      });
    });

    it("only records for articles that are in the target set", async () => {
      const {
        startDeliveryPreviewContext,
        getDeliveryPreviewResultsForArticle,
        getAllDeliveryPreviewResults,
      } = await import("../../delivery-preview/delivery-preview-context");

      await inMemoryArticleFieldStore.startContext(async () => {
        // Only target hash-1, but process multiple articles
        const targetHashes = new Set(["hash-1"]);

        await startDeliveryPreviewContext(targetHashes, async () => {
          await getArticlesToDeliver(
            inMemoryArticleFieldStore,
            "multi-diag-feed-4",
            [
              createArticle("1", { title: "Article 1" }),
              createArticle("2", { title: "Article 2" }),
              createArticle("3", { title: "Article 3" }),
            ],
            { blockingComparisons: [], passingComparisons: [] }
          );

          const allResults = getAllDeliveryPreviewResults();

          // Only hash-1 should have diagnostics recorded
          assert.ok(allResults.has("hash-1"));
          assert.ok(!allResults.has("hash-2"));
          assert.ok(!allResults.has("hash-3"));

          // hash-1 should have diagnostics
          const diag1 = getDeliveryPreviewResultsForArticle("hash-1");
          assert.ok(diag1.length > 0);

          // hash-2 and hash-3 should not have diagnostics
          const diag2 = getDeliveryPreviewResultsForArticle("hash-2");
          const diag3 = getDeliveryPreviewResultsForArticle("hash-3");
          assert.deepStrictEqual(diag2, []);
          assert.deepStrictEqual(diag3, []);
        });
      });
    });
  });
});

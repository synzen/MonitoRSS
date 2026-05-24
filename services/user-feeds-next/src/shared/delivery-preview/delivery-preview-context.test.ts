import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
  startDeliveryPreviewContext,
  isDeliveryPreviewMode,
  getTargetArticleIdHash,
  clearDeliveryPreviewContext,
  recordDeliveryPreviewForArticle,
  getDeliveryPreviewResultsForArticle,
  getAllDeliveryPreviewResults,
  recordDeliveryPreviewForTargetArticles,
} from "./delivery-preview-context";
import { DeliveryPreviewStage, DeliveryPreviewStageStatus } from "./types";
import type { DeliveryPreviewStageResult } from "./types";

describe("delivery-preview-context", () => {
  beforeEach(() => {
    clearDeliveryPreviewContext();
  });

  describe("isDeliveryPreviewMode", () => {
    it("returns false outside delivery preview context", () => {
      assert.strictEqual(isDeliveryPreviewMode(), false);
    });

    it("returns true inside delivery preview context", async () => {
      let insideValue = false;

      await startDeliveryPreviewContext("test-hash", async () => {
        insideValue = isDeliveryPreviewMode();
      });

      assert.strictEqual(insideValue, true);
    });

    it("returns false after delivery preview context ends", async () => {
      await startDeliveryPreviewContext("test-hash", async () => {
        // Inside context
      });

      assert.strictEqual(isDeliveryPreviewMode(), false);
    });
  });

  describe("getTargetArticleIdHash", () => {
    it("returns null outside delivery preview context", () => {
      assert.strictEqual(getTargetArticleIdHash(), null);
    });

    it("returns the target article hash inside delivery preview context", async () => {
      const captured: { hash: string | null } = { hash: null };

      await startDeliveryPreviewContext("my-article-hash", async () => {
        captured.hash = getTargetArticleIdHash();
      });

      assert.strictEqual(captured.hash, "my-article-hash");
    });
  });

  describe("startDeliveryPreviewContext", () => {
    it("returns the result of the callback", async () => {
      const result = await startDeliveryPreviewContext("test-hash", async () => {
        return { value: 42, message: "success" };
      });

      assert.deepStrictEqual(result, { value: 42, message: "success" });
    });

    it("propagates errors from the callback", async () => {
      const error = new Error("Test error");

      await assert.rejects(
        startDeliveryPreviewContext("test-hash", async () => {
          throw error;
        }),
        { message: "Test error" }
      );
    });
  });

  describe("multi-target delivery preview context", () => {
    it("startDeliveryPreviewContext accepts Set<string> of target hashes", async () => {
      const targetHashes = new Set(["hash1", "hash2", "hash3"]);

      await startDeliveryPreviewContext(targetHashes, async () => {
        assert.strictEqual(isDeliveryPreviewMode(), true);
      });
    });

    it("recordDeliveryPreviewForArticle stores to correct hash's stage array", async () => {
      const targetHashes = new Set(["hash1", "hash2"]);

      await startDeliveryPreviewContext(targetHashes, async () => {
        const stage1: DeliveryPreviewStageResult = {
          stage: DeliveryPreviewStage.FeedState,
          status: DeliveryPreviewStageStatus.Passed,
          details: {
            hasPriorArticles: true,
            isFirstRun: false,
            storedComparisonNames: [],
          },
        };

        const stage2: DeliveryPreviewStageResult = {
          stage: DeliveryPreviewStage.IdComparison,
          status: DeliveryPreviewStageStatus.Passed,
          details: {
            articleIdHash: "hash2",
            foundInHotPartition: false,
            foundInColdPartition: false,
            isNew: true,
          },
        };

        recordDeliveryPreviewForArticle("hash1", stage1);
        recordDeliveryPreviewForArticle("hash2", stage2);

        const hash1Results = getDeliveryPreviewResultsForArticle("hash1");
        const hash2Results = getDeliveryPreviewResultsForArticle("hash2");

        assert.strictEqual(hash1Results.length, 1);
        assert.strictEqual(hash1Results[0]?.stage, DeliveryPreviewStage.FeedState);

        assert.strictEqual(hash2Results.length, 1);
        assert.strictEqual(hash2Results[0]?.stage, DeliveryPreviewStage.IdComparison);
      });
    });

    it("recordDeliveryPreviewForArticle accumulates multiple stages for same hash", async () => {
      const targetHashes = new Set(["hash1"]);

      await startDeliveryPreviewContext(targetHashes, async () => {
        const feedState: DeliveryPreviewStageResult = {
          stage: DeliveryPreviewStage.FeedState,
          status: DeliveryPreviewStageStatus.Passed,
          details: {
            hasPriorArticles: true,
            isFirstRun: false,
            storedComparisonNames: [],
          },
        };

        const idComparison: DeliveryPreviewStageResult = {
          stage: DeliveryPreviewStage.IdComparison,
          status: DeliveryPreviewStageStatus.Passed,
          details: {
            articleIdHash: "hash1",
            foundInHotPartition: false,
            foundInColdPartition: false,
            isNew: true,
          },
        };

        recordDeliveryPreviewForArticle("hash1", feedState);
        recordDeliveryPreviewForArticle("hash1", idComparison);

        const results = getDeliveryPreviewResultsForArticle("hash1");
        assert.strictEqual(results.length, 2);
        assert.strictEqual(results[0]?.stage, DeliveryPreviewStage.FeedState);
        assert.strictEqual(results[1]?.stage, DeliveryPreviewStage.IdComparison);
      });
    });

    it("getDeliveryPreviewResultsForArticle returns empty array for non-target hash", async () => {
      const targetHashes = new Set(["hash1"]);

      await startDeliveryPreviewContext(targetHashes, async () => {
        const results = getDeliveryPreviewResultsForArticle("non-existent");
        assert.deepStrictEqual(results, []);
      });
    });

    it("getDeliveryPreviewResultsForArticle returns empty array outside context", () => {
      const results = getDeliveryPreviewResultsForArticle("hash1");
      assert.deepStrictEqual(results, []);
    });

    it("getAllDeliveryPreviewResults returns Map of all recorded previews", async () => {
      const targetHashes = new Set(["hash1", "hash2"]);

      await startDeliveryPreviewContext(targetHashes, async () => {
        const stage1: DeliveryPreviewStageResult = {
          stage: DeliveryPreviewStage.FeedState,
          status: DeliveryPreviewStageStatus.Passed,
          details: {
            hasPriorArticles: true,
            isFirstRun: false,
            storedComparisonNames: [],
          },
        };

        const stage2: DeliveryPreviewStageResult = {
          stage: DeliveryPreviewStage.IdComparison,
          status: DeliveryPreviewStageStatus.Passed,
          details: {
            articleIdHash: "hash2",
            foundInHotPartition: false,
            foundInColdPartition: false,
            isNew: true,
          },
        };

        recordDeliveryPreviewForArticle("hash1", stage1);
        recordDeliveryPreviewForArticle("hash2", stage2);

        const allResults = getAllDeliveryPreviewResults();

        assert.ok(allResults instanceof Map);
        assert.strictEqual(allResults.size, 2);
        assert.strictEqual(allResults.get("hash1")!.length, 1);
        assert.strictEqual(allResults.get("hash2")!.length, 1);
      });
    });

    it("getAllDeliveryPreviewResults returns empty Map outside context", () => {
      const results = getAllDeliveryPreviewResults();
      assert.ok(results instanceof Map);
      assert.strictEqual(results.size, 0);
    });

    it("recordDeliveryPreviewForArticle does nothing for non-target hash", async () => {
      const targetHashes = new Set(["hash1"]);

      await startDeliveryPreviewContext(targetHashes, async () => {
        const stage: DeliveryPreviewStageResult = {
          stage: DeliveryPreviewStage.FeedState,
          status: DeliveryPreviewStageStatus.Passed,
          details: {
            hasPriorArticles: true,
            isFirstRun: false,
            storedComparisonNames: [],
          },
        };

        recordDeliveryPreviewForArticle("non-target", stage);

        const allResults = getAllDeliveryPreviewResults();
        assert.strictEqual(allResults.has("non-target"), false);
      });
    });
  });

  describe("recordDeliveryPreviewForTargetArticles", () => {
    it("calls callback only for target articles in the map", async () => {
      const targetHashes = new Set(["hash1", "hash2"]);
      const articleMap = new Map([
        ["hash1", { id: "article1" }],
        ["hash2", { id: "article2" }],
        ["hash3", { id: "article3" }],
      ]);

      await startDeliveryPreviewContext(targetHashes, async () => {
        recordDeliveryPreviewForTargetArticles(articleMap, (article, hash) => ({
          stage: DeliveryPreviewStage.FeedState,
          status: DeliveryPreviewStageStatus.Passed,
          details: {
            hasPriorArticles: true,
            isFirstRun: false,
            storedComparisonNames: [hash],
          },
        }));

        const allResults = getAllDeliveryPreviewResults();
        assert.strictEqual(allResults.size, 2);
        assert.strictEqual(allResults.has("hash1"), true);
        assert.strictEqual(allResults.has("hash2"), true);
        assert.strictEqual(allResults.has("hash3"), false);
      });
    });

    it("does nothing when not in delivery preview mode", () => {
      const articleMap = new Map([["hash1", { id: "article1" }]]);
      let callCount = 0;

      recordDeliveryPreviewForTargetArticles(articleMap, () => {
        callCount++;
        return {
          stage: DeliveryPreviewStage.FeedState,
          status: DeliveryPreviewStageStatus.Passed,
          details: {
            hasPriorArticles: true,
            isFirstRun: false,
            storedComparisonNames: [],
          },
        };
      });

      assert.strictEqual(callCount, 0);
    });

    it("does nothing when target hash not in map", async () => {
      const targetHashes = new Set(["hash1"]);
      const articleMap = new Map([["hash2", { id: "article2" }]]);

      await startDeliveryPreviewContext(targetHashes, async () => {
        recordDeliveryPreviewForTargetArticles(articleMap, () => ({
          stage: DeliveryPreviewStage.FeedState,
          status: DeliveryPreviewStageStatus.Passed,
          details: {
            hasPriorArticles: true,
            isFirstRun: false,
            storedComparisonNames: [],
          },
        }));

        const allResults = getAllDeliveryPreviewResults();
        assert.strictEqual(allResults.size, 0);
      });
    });

    it("skips recording when callback returns null", async () => {
      const targetHashes = new Set(["hash1", "hash2"]);
      const articleMap = new Map([
        ["hash1", { id: "article1" }],
        ["hash2", { id: "article2" }],
      ]);

      await startDeliveryPreviewContext(targetHashes, async () => {
        recordDeliveryPreviewForTargetArticles(articleMap, (_, hash) => {
          if (hash === "hash1") return null;
          return {
            stage: DeliveryPreviewStage.FeedState,
            status: DeliveryPreviewStageStatus.Passed,
            details: {
              hasPriorArticles: true,
              isFirstRun: false,
              storedComparisonNames: [],
            },
          };
        });

        const allResults = getAllDeliveryPreviewResults();
        assert.strictEqual(allResults.size, 1);
        assert.strictEqual(allResults.has("hash1"), false);
        assert.strictEqual(allResults.has("hash2"), true);
      });
    });
  });

  describe("concurrency", () => {
    it("maintains separate delivery preview contexts for concurrent requests", async () => {
      const results = await Promise.all([
        startDeliveryPreviewContext("hash-1", async () => {
          recordDeliveryPreviewForArticle("hash-1", {
            stage: DeliveryPreviewStage.FeedState,
            status: DeliveryPreviewStageStatus.Passed,
            details: {
              hasPriorArticles: false,
              isFirstRun: true,
              storedComparisonNames: [],
            },
          });
          await new Promise((resolve) => setTimeout(resolve, 10));
          return getDeliveryPreviewResultsForArticle("hash-1");
        }),
        startDeliveryPreviewContext("hash-2", async () => {
          recordDeliveryPreviewForArticle("hash-2", {
            stage: DeliveryPreviewStage.FeedState,
            status: DeliveryPreviewStageStatus.Failed,
            details: {
              hasPriorArticles: true,
              isFirstRun: false,
              storedComparisonNames: ["title"],
            },
          });
          await new Promise((resolve) => setTimeout(resolve, 10));
          return getDeliveryPreviewResultsForArticle("hash-2");
        }),
      ]);

      // Verify contexts didn't leak - each should only have its own preview
      assert.strictEqual(results[0]!.length, 1);
      assert.strictEqual((results[0]![0]!.details as { isFirstRun: boolean }).isFirstRun, true);

      assert.strictEqual(results[1]!.length, 1);
      assert.strictEqual((results[1]![0]!.details as { isFirstRun: boolean }).isFirstRun, false);
    });

    it("does not leak previews between interleaved contexts", async () => {
      const [result1, result2] = await Promise.all([
        startDeliveryPreviewContext("ctx1-hash", async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          recordDeliveryPreviewForArticle("ctx1-hash", {
            stage: DeliveryPreviewStage.IdComparison,
            status: DeliveryPreviewStageStatus.Passed,
            details: {
              articleIdHash: "ctx1-hash",
              foundInHotPartition: false,
              foundInColdPartition: false,
              isNew: true,
            },
          });
          // Try to record to the other context's hash - should be ignored
          recordDeliveryPreviewForArticle("ctx2-hash", {
            stage: DeliveryPreviewStage.IdComparison,
            status: DeliveryPreviewStageStatus.Failed,
            details: {
              articleIdHash: "ctx2-hash",
              foundInHotPartition: true,
              foundInColdPartition: false,
              isNew: false,
            },
          });
          return getDeliveryPreviewResultsForArticle("ctx1-hash");
        }),
        startDeliveryPreviewContext("ctx2-hash", async () => {
          recordDeliveryPreviewForArticle("ctx2-hash", {
            stage: DeliveryPreviewStage.DateCheck,
            status: DeliveryPreviewStageStatus.Passed,
            details: {
              articleDate: "2024-01-01",
              threshold: 86400000,
              datePlaceholders: ["pubdate"],
              ageMs: 1000,
              withinThreshold: true,
            },
          });
          return getDeliveryPreviewResultsForArticle("ctx2-hash");
        }),
      ]);

      // Context 1 should only have IdComparison
      assert.strictEqual(result1!.length, 1);
      assert.strictEqual(result1![0]!.stage, DeliveryPreviewStage.IdComparison);

      // Context 2 should only have DateCheck (not the IdComparison attempted from ctx1)
      assert.strictEqual(result2!.length, 1);
      assert.strictEqual(result2![0]!.stage, DeliveryPreviewStage.DateCheck);
    });
  });
});

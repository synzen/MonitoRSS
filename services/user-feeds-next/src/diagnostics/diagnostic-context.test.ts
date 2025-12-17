import { describe, expect, it, beforeEach } from "bun:test";
import {
  startDiagnosticContext,
  isDiagnosticMode,
  getTargetArticleIdHash,
  clearDiagnosticContext,
  recordDiagnosticForArticle,
  getDiagnosticResultsForArticle,
  getAllDiagnosticResults,
  recordDiagnosticForTargetArticles,
} from "./diagnostic-context";
import { DiagnosticStage } from "./types";
import type { DiagnosticStageResult } from "./types";

describe("diagnostic-context", () => {
  beforeEach(() => {
    clearDiagnosticContext();
  });

  describe("isDiagnosticMode", () => {
    it("returns false outside diagnostic context", () => {
      expect(isDiagnosticMode()).toBe(false);
    });

    it("returns true inside diagnostic context", async () => {
      let insideValue = false;

      await startDiagnosticContext("test-hash", async () => {
        insideValue = isDiagnosticMode();
      });

      expect(insideValue).toBe(true);
    });

    it("returns false after diagnostic context ends", async () => {
      await startDiagnosticContext("test-hash", async () => {
        // Inside context
      });

      expect(isDiagnosticMode()).toBe(false);
    });
  });

  describe("getTargetArticleIdHash", () => {
    it("returns null outside diagnostic context", () => {
      expect(getTargetArticleIdHash()).toBeNull();
    });

    it("returns the target article hash inside diagnostic context", async () => {
      const captured: { hash: string | null } = { hash: null };

      await startDiagnosticContext("my-article-hash", async () => {
        captured.hash = getTargetArticleIdHash();
      });

      expect(captured.hash).toBe("my-article-hash");
    });
  });

  describe("startDiagnosticContext", () => {
    it("returns the result of the callback", async () => {
      const result = await startDiagnosticContext("test-hash", async () => {
        return { value: 42, message: "success" };
      });

      expect(result).toEqual({ value: 42, message: "success" });
    });

    it("propagates errors from the callback", async () => {
      const error = new Error("Test error");

      await expect(
        startDiagnosticContext("test-hash", async () => {
          throw error;
        })
      ).rejects.toThrow("Test error");
    });
  });

  describe("multi-target diagnostic context", () => {
    it("startDiagnosticContext accepts Set<string> of target hashes", async () => {
      const targetHashes = new Set(["hash1", "hash2", "hash3"]);

      await startDiagnosticContext(targetHashes, async () => {
        expect(isDiagnosticMode()).toBe(true);
      });
    });

    it("recordDiagnosticForArticle stores to correct hash's stage array", async () => {
      const targetHashes = new Set(["hash1", "hash2"]);

      await startDiagnosticContext(targetHashes, async () => {
        const stage1: DiagnosticStageResult = {
          stage: DiagnosticStage.FeedState,
          passed: true,
          details: {
            hasPriorArticles: true,
            isFirstRun: false,
            storedComparisonNames: [],
          },
        };

        const stage2: DiagnosticStageResult = {
          stage: DiagnosticStage.IdComparison,
          passed: true,
          details: {
            articleIdHash: "hash2",
            foundInHotPartition: false,
            foundInColdPartition: false,
            isNew: true,
          },
        };

        recordDiagnosticForArticle("hash1", stage1);
        recordDiagnosticForArticle("hash2", stage2);

        const hash1Results = getDiagnosticResultsForArticle("hash1");
        const hash2Results = getDiagnosticResultsForArticle("hash2");

        expect(hash1Results).toHaveLength(1);
        expect(hash1Results[0]?.stage).toBe(DiagnosticStage.FeedState);

        expect(hash2Results).toHaveLength(1);
        expect(hash2Results[0]?.stage).toBe(DiagnosticStage.IdComparison);
      });
    });

    it("recordDiagnosticForArticle accumulates multiple stages for same hash", async () => {
      const targetHashes = new Set(["hash1"]);

      await startDiagnosticContext(targetHashes, async () => {
        const feedState: DiagnosticStageResult = {
          stage: DiagnosticStage.FeedState,
          passed: true,
          details: {
            hasPriorArticles: true,
            isFirstRun: false,
            storedComparisonNames: [],
          },
        };

        const idComparison: DiagnosticStageResult = {
          stage: DiagnosticStage.IdComparison,
          passed: true,
          details: {
            articleIdHash: "hash1",
            foundInHotPartition: false,
            foundInColdPartition: false,
            isNew: true,
          },
        };

        recordDiagnosticForArticle("hash1", feedState);
        recordDiagnosticForArticle("hash1", idComparison);

        const results = getDiagnosticResultsForArticle("hash1");
        expect(results).toHaveLength(2);
        expect(results[0]?.stage).toBe(DiagnosticStage.FeedState);
        expect(results[1]?.stage).toBe(DiagnosticStage.IdComparison);
      });
    });

    it("getDiagnosticResultsForArticle returns empty array for non-target hash", async () => {
      const targetHashes = new Set(["hash1"]);

      await startDiagnosticContext(targetHashes, async () => {
        const results = getDiagnosticResultsForArticle("non-existent");
        expect(results).toEqual([]);
      });
    });

    it("getDiagnosticResultsForArticle returns empty array outside context", () => {
      const results = getDiagnosticResultsForArticle("hash1");
      expect(results).toEqual([]);
    });

    it("getAllDiagnosticResults returns Map of all recorded diagnostics", async () => {
      const targetHashes = new Set(["hash1", "hash2"]);

      await startDiagnosticContext(targetHashes, async () => {
        const stage1: DiagnosticStageResult = {
          stage: DiagnosticStage.FeedState,
          passed: true,
          details: {
            hasPriorArticles: true,
            isFirstRun: false,
            storedComparisonNames: [],
          },
        };

        const stage2: DiagnosticStageResult = {
          stage: DiagnosticStage.IdComparison,
          passed: true,
          details: {
            articleIdHash: "hash2",
            foundInHotPartition: false,
            foundInColdPartition: false,
            isNew: true,
          },
        };

        recordDiagnosticForArticle("hash1", stage1);
        recordDiagnosticForArticle("hash2", stage2);

        const allResults = getAllDiagnosticResults();

        expect(allResults).toBeInstanceOf(Map);
        expect(allResults.size).toBe(2);
        expect(allResults.get("hash1")).toHaveLength(1);
        expect(allResults.get("hash2")).toHaveLength(1);
      });
    });

    it("getAllDiagnosticResults returns empty Map outside context", () => {
      const results = getAllDiagnosticResults();
      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(0);
    });

    it("recordDiagnosticForArticle does nothing for non-target hash", async () => {
      const targetHashes = new Set(["hash1"]);

      await startDiagnosticContext(targetHashes, async () => {
        const stage: DiagnosticStageResult = {
          stage: DiagnosticStage.FeedState,
          passed: true,
          details: {
            hasPriorArticles: true,
            isFirstRun: false,
            storedComparisonNames: [],
          },
        };

        recordDiagnosticForArticle("non-target", stage);

        const allResults = getAllDiagnosticResults();
        expect(allResults.has("non-target")).toBe(false);
      });
    });
  });

  describe("recordDiagnosticForTargetArticles", () => {
    it("calls callback only for target articles in the map", async () => {
      const targetHashes = new Set(["hash1", "hash2"]);
      const articleMap = new Map([
        ["hash1", { id: "article1" }],
        ["hash2", { id: "article2" }],
        ["hash3", { id: "article3" }],
      ]);

      await startDiagnosticContext(targetHashes, async () => {
        recordDiagnosticForTargetArticles(articleMap, (article, hash) => ({
          stage: DiagnosticStage.FeedState,
          passed: true,
          details: {
            hasPriorArticles: true,
            isFirstRun: false,
            storedComparisonNames: [hash],
          },
        }));

        const allResults = getAllDiagnosticResults();
        expect(allResults.size).toBe(2);
        expect(allResults.has("hash1")).toBe(true);
        expect(allResults.has("hash2")).toBe(true);
        expect(allResults.has("hash3")).toBe(false);
      });
    });

    it("does nothing when not in diagnostic mode", () => {
      const articleMap = new Map([["hash1", { id: "article1" }]]);
      let callCount = 0;

      recordDiagnosticForTargetArticles(articleMap, () => {
        callCount++;
        return {
          stage: DiagnosticStage.FeedState,
          passed: true,
          details: {
            hasPriorArticles: true,
            isFirstRun: false,
            storedComparisonNames: [],
          },
        };
      });

      expect(callCount).toBe(0);
    });

    it("does nothing when target hash not in map", async () => {
      const targetHashes = new Set(["hash1"]);
      const articleMap = new Map([["hash2", { id: "article2" }]]);

      await startDiagnosticContext(targetHashes, async () => {
        recordDiagnosticForTargetArticles(articleMap, () => ({
          stage: DiagnosticStage.FeedState,
          passed: true,
          details: {
            hasPriorArticles: true,
            isFirstRun: false,
            storedComparisonNames: [],
          },
        }));

        const allResults = getAllDiagnosticResults();
        expect(allResults.size).toBe(0);
      });
    });

    it("skips recording when callback returns null", async () => {
      const targetHashes = new Set(["hash1", "hash2"]);
      const articleMap = new Map([
        ["hash1", { id: "article1" }],
        ["hash2", { id: "article2" }],
      ]);

      await startDiagnosticContext(targetHashes, async () => {
        recordDiagnosticForTargetArticles(articleMap, (_, hash) => {
          if (hash === "hash1") return null;
          return {
            stage: DiagnosticStage.FeedState,
            passed: true,
            details: {
              hasPriorArticles: true,
              isFirstRun: false,
              storedComparisonNames: [],
            },
          };
        });

        const allResults = getAllDiagnosticResults();
        expect(allResults.size).toBe(1);
        expect(allResults.has("hash1")).toBe(false);
        expect(allResults.has("hash2")).toBe(true);
      });
    });
  });

  describe("concurrency", () => {
    it("maintains separate diagnostic contexts for concurrent requests", async () => {
      const results = await Promise.all([
        startDiagnosticContext("hash-1", async () => {
          recordDiagnosticForArticle("hash-1", {
            stage: DiagnosticStage.FeedState,
            passed: true,
            details: {
              hasPriorArticles: false,
              isFirstRun: true,
              storedComparisonNames: [],
            },
          });
          await new Promise((resolve) => setTimeout(resolve, 10));
          return getDiagnosticResultsForArticle("hash-1");
        }),
        startDiagnosticContext("hash-2", async () => {
          recordDiagnosticForArticle("hash-2", {
            stage: DiagnosticStage.FeedState,
            passed: false,
            details: {
              hasPriorArticles: true,
              isFirstRun: false,
              storedComparisonNames: ["title"],
            },
          });
          await new Promise((resolve) => setTimeout(resolve, 10));
          return getDiagnosticResultsForArticle("hash-2");
        }),
      ]);

      // Verify contexts didn't leak - each should only have its own diagnostic
      expect(results[0]).toHaveLength(1);
      expect(
        (results[0][0]!.details as { isFirstRun: boolean }).isFirstRun
      ).toBe(true);

      expect(results[1]).toHaveLength(1);
      expect(
        (results[1][0]!.details as { isFirstRun: boolean }).isFirstRun
      ).toBe(false);
    });

    it("does not leak diagnostics between interleaved contexts", async () => {
      const [result1, result2] = await Promise.all([
        startDiagnosticContext("ctx1-hash", async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          recordDiagnosticForArticle("ctx1-hash", {
            stage: DiagnosticStage.IdComparison,
            passed: true,
            details: {
              articleIdHash: "ctx1-hash",
              foundInHotPartition: false,
              foundInColdPartition: false,
              isNew: true,
            },
          });
          // Try to record to the other context's hash - should be ignored
          recordDiagnosticForArticle("ctx2-hash", {
            stage: DiagnosticStage.IdComparison,
            passed: false,
            details: {
              articleIdHash: "ctx2-hash",
              foundInHotPartition: true,
              foundInColdPartition: false,
              isNew: false,
            },
          });
          return getDiagnosticResultsForArticle("ctx1-hash");
        }),
        startDiagnosticContext("ctx2-hash", async () => {
          recordDiagnosticForArticle("ctx2-hash", {
            stage: DiagnosticStage.DateCheck,
            passed: true,
            details: {
              articleDate: "2024-01-01",
              threshold: 86400000,
              datePlaceholders: ["pubdate"],
              ageMs: 1000,
              withinThreshold: true,
            },
          });
          return getDiagnosticResultsForArticle("ctx2-hash");
        }),
      ]);

      // Context 1 should only have IdComparison
      expect(result1).toHaveLength(1);
      expect(result1[0]!.stage).toBe(DiagnosticStage.IdComparison);

      // Context 2 should only have DateCheck (not the IdComparison attempted from ctx1)
      expect(result2).toHaveLength(1);
      expect(result2[0]!.stage).toBe(DiagnosticStage.DateCheck);
    });
  });
});

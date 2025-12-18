import { describe, expect, it, beforeEach } from "bun:test";
import { diagnoseArticles } from "./diagnose-articles";
import { ArticleDiagnosisOutcome, DiagnosticStage } from "./types";
import type { DiagnoseArticleDependencies, DiagnoseArticlesInput } from "./diagnose-articles";
import {
  inMemoryArticleFieldStore,
  clearInMemoryStore,
} from "../articles/comparison";
import { createInMemoryDeliveryRecordStore } from "../stores/in-memory/delivery-record-store";
import {
  ArticleDeliveryStatus,
  type ArticleDeliveryState,
} from "../stores/interfaces/delivery-record-store";
import type { Article } from "../articles/parser";
import {
  ExpressionType,
  LogicalExpressionOperator,
  RelationalExpressionOperator,
  RelationalExpressionLeft,
  RelationalExpressionRight,
  type LogicalExpression,
} from "../articles/filters";

function createArticle(
  id: string,
  fields: Record<string, string> = {},
  raw: Record<string, string> = {}
): Article {
  return {
    flattened: {
      id,
      idHash: `hash-${id}`,
      ...fields,
    },
    raw,
  };
}

describe("diagnoseArticle", () => {
  beforeEach(() => {
    clearInMemoryStore();
  });

  function createMockDependencies(): DiagnoseArticleDependencies {
    return {
      articleFieldStore: inMemoryArticleFieldStore,
      deliveryRecordStore: createInMemoryDeliveryRecordStore(),
    };
  }

  function createInput(
    articles: Article[],
    targetArticles?: Article[],
    overrides: Partial<DiagnoseArticlesInput> = {}
  ): DiagnoseArticlesInput {
    return {
      feed: {
        id: "feed-1",
        blockingComparisons: [],
        passingComparisons: [],
      },
      mediums: [],
      articleDayLimit: 20,
      allArticles: articles,
      targetArticles: targetArticles ?? articles,
      ...overrides,
    };
  }

  describe("FirstRunBaseline outcome", () => {
    it("returns FirstRunBaseline when no prior articles stored", async () => {
      const articles = [createArticle("article-1", { title: "Test Article" })];
      const deps = createMockDependencies();
      const input = createInput(articles);

      const { results } = await diagnoseArticles(input, deps);

      expect(results[0]?.outcome).toBe(ArticleDiagnosisOutcome.FirstRunBaseline);
      expect(results[0]?.outcomeReason).toContain("first");
    });
  });

  describe("DuplicateId outcome", () => {
    it("returns DuplicateId when article ID already seen", async () => {
      const articles = [createArticle("article-1", { title: "Test Article" })];
      const deps = createMockDependencies();
      const input = createInput(articles);

      // First run to store the article
      await inMemoryArticleFieldStore.startContext(async () => {
        await inMemoryArticleFieldStore.storeArticles("feed-1", articles, []);
        await inMemoryArticleFieldStore.flushPendingInserts();
      });

      const { results } = await diagnoseArticles(input, deps);

      expect(results[0]?.outcome).toBe(ArticleDiagnosisOutcome.DuplicateId);
      expect(results[0]?.outcomeReason).toContain("already");
    });
  });

  describe("BlockedByComparison outcome", () => {
    it("returns BlockedByComparison when blocking comparison field blocks article", async () => {
      // First article with specific title
      const existingArticle = createArticle("article-old", { title: "Same Title" });
      // New article with same title but different ID
      const newArticle = createArticle("article-new", { title: "Same Title" });

      const deps = createMockDependencies();
      const allArticles = [existingArticle, newArticle];
      const input = createInput(allArticles, [newArticle], {
        feed: {
          id: "feed-1",
          blockingComparisons: ["title"],
          passingComparisons: [],
        },
      });

      // Store the first article with blocking comparison
      await inMemoryArticleFieldStore.startContext(async () => {
        await inMemoryArticleFieldStore.storeArticles(
          "feed-1",
          [existingArticle],
          ["title"]
        );
        await inMemoryArticleFieldStore.storeComparisonNames("feed-1", ["title"]);
        await inMemoryArticleFieldStore.flushPendingInserts();
      });

      const { results } = await diagnoseArticles(input, deps);

      expect(results[0]?.outcome).toBe(ArticleDiagnosisOutcome.BlockedByComparison);
      expect(results[0]?.outcomeReason).toContain("block");
    });
  });

  describe("WouldDeliverPassingComparison outcome", () => {
    it("returns WouldDeliverPassingComparison when seen article has changed field", async () => {
      const article = createArticle("article-1", { title: "Updated Title" });
      const deps = createMockDependencies();
      const input = createInput([article], [article], {
        feed: {
          id: "feed-1",
          blockingComparisons: [],
          passingComparisons: ["title"],
        },
      });

      // Store the article with original title
      const originalArticle = createArticle("article-1", { title: "Original Title" });
      await inMemoryArticleFieldStore.startContext(async () => {
        await inMemoryArticleFieldStore.storeArticles(
          "feed-1",
          [originalArticle],
          ["title"]
        );
        await inMemoryArticleFieldStore.storeComparisonNames("feed-1", ["title"]);
        await inMemoryArticleFieldStore.flushPendingInserts();
      });

      const { results } = await diagnoseArticles(input, deps);

      expect(results[0]?.outcome).toBe(ArticleDiagnosisOutcome.WouldDeliverPassingComparison);
      expect(results[0]?.outcomeReason).toContain("changed");
    });
  });

  describe("FilteredByDateCheck outcome", () => {
    it("returns FilteredByDateCheck when article is too old", async () => {
      const oldDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
      const oldArticle = createArticle(
        "article-old",
        { title: "Old Article" },
        { date: oldDate }
      );
      const deps = createMockDependencies();
      const input = createInput([oldArticle], [oldArticle], {
        feed: {
          id: "feed-1",
          blockingComparisons: [],
          passingComparisons: [],
          dateChecks: {
            oldArticleDateDiffMsThreshold: 1000 * 60 * 60 * 24, // 1 day
          },
        },
      });

      // Store a baseline article first
      const baselineArticle = createArticle("baseline", { title: "Baseline" });
      await inMemoryArticleFieldStore.startContext(async () => {
        await inMemoryArticleFieldStore.storeArticles("feed-1", [baselineArticle], []);
        await inMemoryArticleFieldStore.flushPendingInserts();
      });

      const { results } = await diagnoseArticles(input, deps);

      expect(results[0]?.outcome).toBe(ArticleDiagnosisOutcome.FilteredByDateCheck);
      expect(results[0]?.outcomeReason).toContain("old");
    });
  });

  describe("RateLimitedFeed outcome", () => {
    it("returns RateLimitedFeed when feed daily limit exceeded", async () => {
      const article = createArticle("article-new", { title: "New Article" });
      const deliveryRecordStore = createInMemoryDeliveryRecordStore();
      const deps: DiagnoseArticleDependencies = {
        articleFieldStore: inMemoryArticleFieldStore,
        deliveryRecordStore,
      };

      // Store baseline to make it not first run
      const baselineArticle = createArticle("baseline", { title: "Baseline" });
      await inMemoryArticleFieldStore.startContext(async () => {
        await inMemoryArticleFieldStore.storeArticles("feed-1", [baselineArticle], []);
        await inMemoryArticleFieldStore.flushPendingInserts();
      });

      // Store enough deliveries to exceed limit
      await deliveryRecordStore.startContext(async () => {
        const deliveries: ArticleDeliveryState[] = Array.from(
          { length: 5 },
          (_, i) => ({
            id: `delivery-${i}`,
            mediumId: "medium-1",
            status: ArticleDeliveryStatus.Sent,
            articleIdHash: `hash-${i}`,
            article: createArticle(`${i}`),
          })
        );
        await deliveryRecordStore.store("feed-1", deliveries);
      });

      const input = createInput([article], [article], {
        articleDayLimit: 5, // Already at limit
      });

      const { results } = await diagnoseArticles(input, deps);

      expect(results[0]?.outcome).toBe(ArticleDiagnosisOutcome.RateLimitedFeed);
      expect(results[0]?.outcomeReason).toContain("limit");
    });
  });

  describe("WouldDeliver outcome", () => {
    it("returns WouldDeliver when article passes all checks", async () => {
      const article = createArticle("article-new", { title: "New Article" });
      const deps = createMockDependencies();
      const input = createInput([article]);

      // Store baseline to make it not first run
      const baselineArticle = createArticle("baseline", { title: "Baseline" });
      await inMemoryArticleFieldStore.startContext(async () => {
        await inMemoryArticleFieldStore.storeArticles("feed-1", [baselineArticle], []);
        await inMemoryArticleFieldStore.flushPendingInserts();
      });

      const { results } = await diagnoseArticles(input, deps);

      expect(results[0]?.outcome).toBe(ArticleDiagnosisOutcome.WouldDeliver);
      expect(results[0]?.outcomeReason).toContain("pass");
    });
  });

  describe("stages recorded", () => {
    it("includes FeedState stage in result", async () => {
      const article = createArticle("article-1", { title: "Test" });
      const deps = createMockDependencies();
      const input = createInput([article]);

      const { results } = await diagnoseArticles(input, deps);
      const result = results[0] as { stages: Array<{ stage: DiagnosticStage }> };

      const feedState = result.stages.find(
        (s) => s.stage === DiagnosticStage.FeedState
      );
      expect(feedState).toBeDefined();
    });
  });

  describe("FilteredByMediumFilter outcome", () => {
    it("returns FilteredByMediumFilter when medium filter blocks article", async () => {
      const article = createArticle("article-new", { title: "No Match Here" });
      const deps = createMockDependencies();

      // Create a filter that requires "REQUIRED_KEYWORD" in title
      const blockingFilter: LogicalExpression = {
        type: ExpressionType.Logical,
        op: LogicalExpressionOperator.And,
        children: [
          {
            type: ExpressionType.Relational,
            op: RelationalExpressionOperator.Contains,
            left: { type: RelationalExpressionLeft.Article, value: "title" },
            right: { type: RelationalExpressionRight.String, value: "REQUIRED_KEYWORD" },
          },
        ],
      };

      const input = createInput([article], [article], {
        mediums: [
          {
            id: "medium-1",
            filters: {
              expression: blockingFilter,
            },
          },
        ],
      });

      // Store baseline to make it not first run
      const baselineArticle = createArticle("baseline", { title: "Baseline" });
      await inMemoryArticleFieldStore.startContext(async () => {
        await inMemoryArticleFieldStore.storeArticles("feed-1", [baselineArticle], []);
        await inMemoryArticleFieldStore.flushPendingInserts();
      });

      const { results } = await diagnoseArticles(input, deps);

      expect(results[0]?.outcome).toBe(ArticleDiagnosisOutcome.FilteredByMediumFilter);
      expect(results[0]?.outcomeReason).toContain("filter");
    });

    it("records MediumFilter stage when filter is evaluated", async () => {
      const article = createArticle("article-new", { title: "Test Article" });
      const deps = createMockDependencies();

      // Create a filter that will pass
      const passingFilter: LogicalExpression = {
        type: ExpressionType.Logical,
        op: LogicalExpressionOperator.And,
        children: [
          {
            type: ExpressionType.Relational,
            op: RelationalExpressionOperator.Contains,
            left: { type: RelationalExpressionLeft.Article, value: "title" },
            right: { type: RelationalExpressionRight.String, value: "Test" },
          },
        ],
      };

      const input = createInput([article], [article], {
        mediums: [
          {
            id: "medium-1",
            filters: {
              expression: passingFilter,
            },
          },
        ],
      });

      // Store baseline to make it not first run
      const baselineArticle = createArticle("baseline", { title: "Baseline" });
      await inMemoryArticleFieldStore.startContext(async () => {
        await inMemoryArticleFieldStore.storeArticles("feed-1", [baselineArticle], []);
        await inMemoryArticleFieldStore.flushPendingInserts();
      });

      const { results } = await diagnoseArticles(input, deps);
      const result = results[0] as { stages: Array<{ stage: DiagnosticStage; passed: boolean }> };

      const mediumFilterStage = result.stages.find(
        (s) => s.stage === DiagnosticStage.MediumFilter
      );
      expect(mediumFilterStage).toBeDefined();
      expect(mediumFilterStage!.passed).toBe(true);
    });
  });

  describe("RateLimitedMedium outcome", () => {
    it("returns RateLimitedMedium when medium rate limit exceeded", async () => {
      const article = createArticle("article-new", { title: "New Article" });
      const deliveryRecordStore = createInMemoryDeliveryRecordStore();
      const deps: DiagnoseArticleDependencies = {
        articleFieldStore: inMemoryArticleFieldStore,
        deliveryRecordStore,
      };

      // Store baseline to make it not first run
      const baselineArticle = createArticle("baseline", { title: "Baseline" });
      await inMemoryArticleFieldStore.startContext(async () => {
        await inMemoryArticleFieldStore.storeArticles("feed-1", [baselineArticle], []);
        await inMemoryArticleFieldStore.flushPendingInserts();
      });

      // Store enough deliveries to medium-1 to exceed its limit
      await deliveryRecordStore.startContext(async () => {
        const deliveries: ArticleDeliveryState[] = Array.from(
          { length: 5 },
          (_, i) => ({
            id: `delivery-${i}`,
            mediumId: "medium-1",
            status: ArticleDeliveryStatus.Sent,
            articleIdHash: `hash-${i}`,
            article: createArticle(`${i}`),
          })
        );
        await deliveryRecordStore.store("feed-1", deliveries);
      });

      const input = createInput([article], [article], {
        articleDayLimit: 100, // High feed limit so it doesn't trigger
        mediums: [
          {
            id: "medium-1",
            rateLimits: [
              { limit: 5, timeWindowSeconds: 86400 }, // Already at limit
            ],
          },
        ],
      });

      const { results } = await diagnoseArticles(input, deps);

      expect(results[0]?.outcome).toBe(ArticleDiagnosisOutcome.RateLimitedMedium);
      expect(results[0]?.outcomeReason).toContain("medium");
    });
  });
});

describe("diagnoseArticles (batch)", () => {
  beforeEach(() => {
    clearInMemoryStore();
  });

  function createMockDependencies(): DiagnoseArticleDependencies {
    return {
      articleFieldStore: inMemoryArticleFieldStore,
      deliveryRecordStore: createInMemoryDeliveryRecordStore(),
    };
  }

  function createBatchInput(
    allArticles: Article[],
    targetArticles?: Article[],
    overrides: Partial<DiagnoseArticlesInput> = {}
  ): DiagnoseArticlesInput {
    return {
      feed: {
        id: "feed-1",
        blockingComparisons: [],
        passingComparisons: [],
      },
      mediums: [],
      articleDayLimit: 20,
      allArticles,
      targetArticles: targetArticles ?? allArticles,
      ...overrides,
    };
  }

  describe("returns results for all target articles", () => {
    it("returns results for multiple target articles", async () => {
      const articles = [
        createArticle("article-1", { title: "Article 1" }),
        createArticle("article-2", { title: "Article 2" }),
        createArticle("article-3", { title: "Article 3" }),
      ];
      const deps = createMockDependencies();
      const input = createBatchInput(articles);

      const response = await diagnoseArticles(input, deps);

      expect(response.results).toHaveLength(3);
      expect(response.errors).toHaveLength(0);
      expect(response.results.map((r: { articleId: string }) => r.articleId)).toEqual([
        "article-1",
        "article-2",
        "article-3",
      ]);
    });
  });

  describe("diagnoses only target articles from all articles", () => {
    it("diagnoses subset of articles when targetArticles differs from allArticles", async () => {
      const allArticles = [
        createArticle("article-1", { title: "Article 1" }),
        createArticle("article-2", { title: "Article 2" }),
        createArticle("article-3", { title: "Article 3" }),
      ];
      const targetArticles = [allArticles[1]!]; // Only diagnose article-2
      const deps = createMockDependencies();
      const input = createBatchInput(allArticles, targetArticles);

      const response = await diagnoseArticles(input, deps);

      expect(response.results).toHaveLength(1);
      expect(response.results[0]?.articleId).toBe("article-2");
    });
  });

  describe("each article has independent rate limit diagnostics", () => {
    it("diagnoses each article independently", async () => {
      const articles = [
        createArticle("article-1", { title: "Article 1" }),
        createArticle("article-2", { title: "Article 2" }),
      ];
      const deps = createMockDependencies();
      const input = createBatchInput(articles);

      const response = await diagnoseArticles(input, deps);

      // Both should have FirstRunBaseline since no prior articles
      expect(response.results[0]?.outcome).toBe(
        ArticleDiagnosisOutcome.FirstRunBaseline
      );
      expect(response.results[1]?.outcome).toBe(
        ArticleDiagnosisOutcome.FirstRunBaseline
      );
    });
  });

  describe("summaryOnly option", () => {
    it("summaryOnly=true omits stages from results", async () => {
      const articles = [createArticle("article-1", { title: "Article 1" })];
      const deps = createMockDependencies();
      const input = createBatchInput(articles, articles, {
        summaryOnly: true,
      });

      const response = await diagnoseArticles(input, deps);

      expect(response.results).toHaveLength(1);
      expect(response.results[0]).not.toHaveProperty("stages");
      expect(response.results[0]?.articleId).toBe("article-1");
      expect(response.results[0]?.outcome).toBeDefined();
    });

    it("summaryOnly=false includes stages in results", async () => {
      const articles = [createArticle("article-1", { title: "Article 1" })];
      const deps = createMockDependencies();
      const input = createBatchInput(articles, articles, {
        summaryOnly: false,
      });

      const response = await diagnoseArticles(input, deps);

      expect(response.results).toHaveLength(1);
      expect(response.results[0]).toHaveProperty("stages");
      expect(
        (response.results[0] as { stages: unknown[] }).stages.length
      ).toBeGreaterThan(0);
    });
  });

  describe("empty targetArticles", () => {
    it("returns empty results and no errors for empty targetArticles", async () => {
      const allArticles = [createArticle("article-1", { title: "Article 1" })];
      const deps = createMockDependencies();
      const input = createBatchInput(allArticles, []);

      const response = await diagnoseArticles(input, deps);

      expect(response.results).toHaveLength(0);
      expect(response.errors).toHaveLength(0);
    });
  });
});

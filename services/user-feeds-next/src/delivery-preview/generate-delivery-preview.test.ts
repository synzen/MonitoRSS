import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { generateDeliveryPreview } from "./generate-delivery-preview";
import { ArticleDeliveryOutcome, DeliveryPreviewStage, DeliveryPreviewStageStatus } from "./types";
import type { DeliveryPreviewDependencies, DeliveryPreviewInput } from "./generate-delivery-preview";
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

describe("generateDeliveryPreview", { concurrency: true }, () => {
  beforeEach(() => {
    clearInMemoryStore();
  });

  function createMockDependencies(): DeliveryPreviewDependencies {
    return {
      articleFieldStore: inMemoryArticleFieldStore,
      deliveryRecordStore: createInMemoryDeliveryRecordStore(),
    };
  }

  function createInput(
    articles: Article[],
    targetArticles?: Article[],
    overrides: Partial<DeliveryPreviewInput> = {}
  ): DeliveryPreviewInput {
    return {
      feed: {
        id: "feed-1",
        blockingComparisons: [],
        passingComparisons: [],
      },
      mediums: [{ id: "medium-1" }],
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

      const { results } = await generateDeliveryPreview(input, deps);

      assert.strictEqual(results[0]?.mediumResults[0]?.outcome, ArticleDeliveryOutcome.FirstRunBaseline);
      assert.ok(results[0]?.mediumResults[0]?.outcomeReason?.includes("first"));
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

      const { results } = await generateDeliveryPreview(input, deps);

      assert.strictEqual(results[0]?.mediumResults[0]?.outcome, ArticleDeliveryOutcome.DuplicateId);
      assert.ok(results[0]?.mediumResults[0]?.outcomeReason?.includes("already"));
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

      const { results } = await generateDeliveryPreview(input, deps);

      assert.strictEqual(results[0]?.mediumResults[0]?.outcome, ArticleDeliveryOutcome.BlockedByComparison);
      assert.ok(results[0]?.mediumResults[0]?.outcomeReason?.includes("block"));
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

      const { results } = await generateDeliveryPreview(input, deps);

      assert.strictEqual(results[0]?.mediumResults[0]?.outcome, ArticleDeliveryOutcome.WouldDeliverPassingComparison);
      assert.ok(results[0]?.mediumResults[0]?.outcomeReason?.includes("changed"));
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

      const { results } = await generateDeliveryPreview(input, deps);

      assert.strictEqual(results[0]?.mediumResults[0]?.outcome, ArticleDeliveryOutcome.FilteredByDateCheck);
      assert.ok(results[0]?.mediumResults[0]?.outcomeReason?.includes("old"));
    });
  });

  describe("RateLimitedFeed outcome", () => {
    it("returns RateLimitedFeed when feed daily limit exceeded", async () => {
      const article = createArticle("article-new", { title: "New Article" });
      const deliveryRecordStore = createInMemoryDeliveryRecordStore();
      const deps: DeliveryPreviewDependencies = {
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

      const { results } = await generateDeliveryPreview(input, deps);

      assert.strictEqual(results[0]?.mediumResults[0]?.outcome, ArticleDeliveryOutcome.RateLimitedFeed);
      assert.ok(results[0]?.mediumResults[0]?.outcomeReason?.includes("limit"));
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

      const { results } = await generateDeliveryPreview(input, deps);

      assert.strictEqual(results[0]?.mediumResults[0]?.outcome, ArticleDeliveryOutcome.WouldDeliver);
      assert.ok(results[0]?.mediumResults[0]?.outcomeReason?.includes("pass"));
    });
  });

  describe("stages recorded", () => {
    it("includes FeedState stage in medium result", async () => {
      const article = createArticle("article-1", { title: "Test" });
      const deps = createMockDependencies();
      const input = createInput([article]);

      const { results } = await generateDeliveryPreview(input, deps);
      const mediumResult = results[0]?.mediumResults[0] as { stages: Array<{ stage: DeliveryPreviewStage }> };

      const feedState = mediumResult.stages.find(
        (s) => s.stage === DeliveryPreviewStage.FeedState
      );
      assert.notStrictEqual(feedState, undefined);
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

      const { results } = await generateDeliveryPreview(input, deps);

      assert.strictEqual(results[0]?.mediumResults[0]?.outcome, ArticleDeliveryOutcome.FilteredByMediumFilter);
      assert.ok(results[0]?.mediumResults[0]?.outcomeReason?.includes("filter"));
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

      const { results } = await generateDeliveryPreview(input, deps);
      const mediumResult = results[0]?.mediumResults[0] as { stages: Array<{ stage: DeliveryPreviewStage; status: DeliveryPreviewStageStatus }> };

      const mediumFilterStage = mediumResult.stages.find(
        (s) => s.stage === DeliveryPreviewStage.MediumFilter
      );
      assert.notStrictEqual(mediumFilterStage, undefined);
      assert.strictEqual(mediumFilterStage!.status, DeliveryPreviewStageStatus.Passed);
    });
  });

  describe("RateLimitedMedium outcome", () => {
    it("returns RateLimitedMedium when medium rate limit exceeded", async () => {
      const article = createArticle("article-new", { title: "New Article" });
      const deliveryRecordStore = createInMemoryDeliveryRecordStore();
      const deps: DeliveryPreviewDependencies = {
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

      const { results } = await generateDeliveryPreview(input, deps);

      assert.strictEqual(results[0]?.mediumResults[0]?.outcome, ArticleDeliveryOutcome.RateLimitedMedium);
      assert.ok(results[0]?.mediumResults[0]?.outcomeReason?.includes("rate limit"));
    });
  });
});

describe("generateDeliveryPreview (batch)", { concurrency: true }, () => {
  beforeEach(() => {
    clearInMemoryStore();
  });

  function createMockDependencies(): DeliveryPreviewDependencies {
    return {
      articleFieldStore: inMemoryArticleFieldStore,
      deliveryRecordStore: createInMemoryDeliveryRecordStore(),
    };
  }

  function createBatchInput(
    allArticles: Article[],
    targetArticles?: Article[],
    overrides: Partial<DeliveryPreviewInput> = {}
  ): DeliveryPreviewInput {
    return {
      feed: {
        id: "feed-1",
        blockingComparisons: [],
        passingComparisons: [],
      },
      mediums: [{ id: "medium-1" }],
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

      const response = await generateDeliveryPreview(input, deps);

      assert.strictEqual(response.results.length, 3);
      assert.strictEqual(response.errors.length, 0);
      assert.deepStrictEqual(response.results.map((r: { articleId: string }) => r.articleId), [
        "article-1",
        "article-2",
        "article-3",
      ]);
    });
  });

  describe("generates preview only for target articles from all articles", () => {
    it("generates preview for subset of articles when targetArticles differs from allArticles", async () => {
      const allArticles = [
        createArticle("article-1", { title: "Article 1" }),
        createArticle("article-2", { title: "Article 2" }),
        createArticle("article-3", { title: "Article 3" }),
      ];
      const targetArticles = [allArticles[1]!]; // Only preview article-2
      const deps = createMockDependencies();
      const input = createBatchInput(allArticles, targetArticles);

      const response = await generateDeliveryPreview(input, deps);

      assert.strictEqual(response.results.length, 1);
      assert.strictEqual(response.results[0]?.articleId, "article-2");
    });
  });

  describe("each article has independent rate limit previews", () => {
    it("generates preview for each article independently", async () => {
      const articles = [
        createArticle("article-1", { title: "Article 1" }),
        createArticle("article-2", { title: "Article 2" }),
      ];
      const deps = createMockDependencies();
      const input = createBatchInput(articles);

      const response = await generateDeliveryPreview(input, deps);

      // Both should have FirstRunBaseline since no prior articles
      assert.strictEqual(response.results[0]?.mediumResults[0]?.outcome, ArticleDeliveryOutcome.FirstRunBaseline);
      assert.strictEqual(response.results[1]?.mediumResults[0]?.outcome, ArticleDeliveryOutcome.FirstRunBaseline);
    });
  });

  describe("summaryOnly option", () => {
    it("summaryOnly=true omits stages from medium results", async () => {
      const articles = [createArticle("article-1", { title: "Article 1" })];
      const deps = createMockDependencies();
      const input = createBatchInput(articles, articles, {
        summaryOnly: true,
      });

      const response = await generateDeliveryPreview(input, deps);

      assert.strictEqual(response.results.length, 1);
      assert.strictEqual(response.results[0]?.articleId, "article-1");
      assert.strictEqual((response.results[0]?.mediumResults[0] as Record<string, unknown>).stages, undefined);
      assert.notStrictEqual(response.results[0]?.mediumResults[0]?.outcome, undefined);
    });

    it("summaryOnly=false includes stages in medium results", async () => {
      const articles = [createArticle("article-1", { title: "Article 1" })];
      const deps = createMockDependencies();
      const input = createBatchInput(articles, articles, {
        summaryOnly: false,
      });

      const response = await generateDeliveryPreview(input, deps);

      assert.strictEqual(response.results.length, 1);
      const mediumResult = response.results[0]?.mediumResults[0] as { stages: unknown[] };
      assert.notStrictEqual(mediumResult.stages, undefined);
      assert.ok(mediumResult.stages.length > 0);
    });
  });

  describe("empty targetArticles", () => {
    it("returns empty results and no errors for empty targetArticles", async () => {
      const allArticles = [createArticle("article-1", { title: "Article 1" })];
      const deps = createMockDependencies();
      const input = createBatchInput(allArticles, []);

      const response = await generateDeliveryPreview(input, deps);

      assert.strictEqual(response.results.length, 0);
      assert.strictEqual(response.errors.length, 0);
    });
  });
});

describe("Aggregate outcome computation", { concurrency: true }, () => {
  beforeEach(() => {
    clearInMemoryStore();
  });

  function createMockDependencies(): DeliveryPreviewDependencies {
    return {
      articleFieldStore: inMemoryArticleFieldStore,
      deliveryRecordStore: createInMemoryDeliveryRecordStore(),
    };
  }

  function createInput(
    allArticles: Article[],
    targetArticles?: Article[],
    overrides: Partial<DeliveryPreviewInput> = {}
  ): DeliveryPreviewInput {
    return {
      feed: {
        id: "feed-1",
        blockingComparisons: [],
        passingComparisons: [],
      },
      mediums: [{ id: "medium-1" }],
      articleDayLimit: 100,
      allArticles,
      targetArticles: targetArticles ?? allArticles,
      ...overrides,
    };
  }

  function createBlockingFilter(requiredKeyword: string): LogicalExpression {
    return {
      type: ExpressionType.Logical,
      op: LogicalExpressionOperator.And,
      children: [
        {
          type: ExpressionType.Relational,
          op: RelationalExpressionOperator.Contains,
          left: { type: RelationalExpressionLeft.Article, value: "title" },
          right: { type: RelationalExpressionRight.String, value: requiredKeyword },
        },
      ],
    };
  }

  async function storeBaseline() {
    const baselineArticle = createArticle("baseline", { title: "Baseline" });
    await inMemoryArticleFieldStore.startContext(async () => {
      await inMemoryArticleFieldStore.storeArticles("feed-1", [baselineArticle], []);
      await inMemoryArticleFieldStore.flushPendingInserts();
    });
  }

  describe("Mixed results aggregate outcome", () => {
    it("returns MixedResults as aggregate outcome when mediums have different outcomes", async () => {
      const article = createArticle("article-1", { title: "Tech News Update" });
      const deps = createMockDependencies();

      await storeBaseline();

      const input = createInput([article], [article], {
        mediums: [
          { id: "medium-1" }, // No filter → passes
          { id: "medium-2", filters: { expression: createBlockingFilter("SPORTS") } }, // Blocks
        ],
      });

      const { results } = await generateDeliveryPreview(input, deps);

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0]?.outcome, ArticleDeliveryOutcome.MixedResults);
      assert.ok(results[0]?.outcomeReason?.includes("Mixed results"));
    });

    it("returns any medium's outcome as aggregate when all mediums have same outcome", async () => {
      const article = createArticle("article-1", { title: "Tech News Update" });
      const deps = createMockDependencies();

      await storeBaseline();

      const input = createInput([article], [article], {
        mediums: [
          { id: "medium-1" }, // No filter → WouldDeliver
          { id: "medium-2" }, // No filter → WouldDeliver
        ],
      });

      const { results } = await generateDeliveryPreview(input, deps);

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0]?.outcome, ArticleDeliveryOutcome.WouldDeliver);
      assert.ok(results[0]?.outcomeReason?.includes("pass"));
    });

    it("returns MixedResults when one medium would deliver and another is rate limited", async () => {
      const article = createArticle("article-1", { title: "New Article" });
      const deliveryRecordStore = createInMemoryDeliveryRecordStore();
      const deps: DeliveryPreviewDependencies = {
        articleFieldStore: inMemoryArticleFieldStore,
        deliveryRecordStore,
      };

      await storeBaseline();

      // Store 5 deliveries to medium-2 to exceed its limit
      await deliveryRecordStore.startContext(async () => {
        const deliveries: ArticleDeliveryState[] = Array.from({ length: 5 }, (_, i): ArticleDeliveryState => ({
          id: `delivery-m2-${i}`,
          mediumId: "medium-2",
          status: ArticleDeliveryStatus.Sent as const,
          articleIdHash: `hash-m2-${i}`,
          article: createArticle(`m2-${i}`),
        }));
        await deliveryRecordStore.store("feed-1", deliveries);
      });

      const input = createInput([article], [article], {
        mediums: [
          { id: "medium-1" }, // No restrictions → WouldDeliver
          { id: "medium-2", rateLimits: [{ limit: 5, timeWindowSeconds: 86400 }] }, // Rate limit exceeded → RateLimitedMedium
        ],
      });

      const { results } = await generateDeliveryPreview(input, deps);

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0]?.outcome, ArticleDeliveryOutcome.MixedResults);
      assert.ok(results[0]?.outcomeReason?.includes("Mixed results"));
    });

    it("returns MixedResults when one medium would deliver and another is filtered", async () => {
      const article = createArticle("article-1", { title: "Tech News" });
      const deps = createMockDependencies();

      await storeBaseline();

      const input = createInput([article], [article], {
        mediums: [
          { id: "medium-1" }, // No filter → WouldDeliver
          { id: "medium-2", filters: { expression: createBlockingFilter("SPORTS") } }, // Filter blocks → FilteredByMediumFilter
        ],
      });

      const { results } = await generateDeliveryPreview(input, deps);

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0]?.outcome, ArticleDeliveryOutcome.MixedResults);
      assert.ok(results[0]?.outcomeReason?.includes("Mixed results"));
    });

    it("returns MixedResults when one medium is rate limited and another is filtered", async () => {
      const article = createArticle("article-1", { title: "Tech News" });
      const deliveryRecordStore = createInMemoryDeliveryRecordStore();
      const deps: DeliveryPreviewDependencies = {
        articleFieldStore: inMemoryArticleFieldStore,
        deliveryRecordStore,
      };

      await storeBaseline();

      // Store 5 deliveries to medium-2 to exceed its limit
      await deliveryRecordStore.startContext(async () => {
        const deliveries: ArticleDeliveryState[] = Array.from({ length: 5 }, (_, i): ArticleDeliveryState => ({
          id: `delivery-m2-${i}`,
          mediumId: "medium-2",
          status: ArticleDeliveryStatus.Sent as const,
          articleIdHash: `hash-m2-${i}`,
          article: createArticle(`m2-${i}`),
        }));
        await deliveryRecordStore.store("feed-1", deliveries);
      });

      const input = createInput([article], [article], {
        mediums: [
          { id: "medium-1", filters: { expression: createBlockingFilter("SPORTS") } }, // Filter blocks → FilteredByMediumFilter
          { id: "medium-2", rateLimits: [{ limit: 5, timeWindowSeconds: 86400 }] }, // Rate limit exceeded → RateLimitedMedium
        ],
      });

      const { results } = await generateDeliveryPreview(input, deps);

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0]?.outcome, ArticleDeliveryOutcome.MixedResults);
      assert.ok(results[0]?.outcomeReason?.includes("Mixed results"));
    });
  });
});

describe("Multiple mediums with different outcomes", { concurrency: true }, () => {
  beforeEach(() => {
    clearInMemoryStore();
  });

  function createMockDependencies(): DeliveryPreviewDependencies {
    return {
      articleFieldStore: inMemoryArticleFieldStore,
      deliveryRecordStore: createInMemoryDeliveryRecordStore(),
    };
  }

  function createInput(
    allArticles: Article[],
    targetArticles?: Article[],
    overrides: Partial<DeliveryPreviewInput> = {}
  ): DeliveryPreviewInput {
    return {
      feed: {
        id: "feed-1",
        blockingComparisons: [],
        passingComparisons: [],
      },
      mediums: [{ id: "medium-1" }],
      articleDayLimit: 100,
      allArticles,
      targetArticles: targetArticles ?? allArticles,
      ...overrides,
    };
  }

  function createBlockingFilter(requiredKeyword: string): LogicalExpression {
    return {
      type: ExpressionType.Logical,
      op: LogicalExpressionOperator.And,
      children: [
        {
          type: ExpressionType.Relational,
          op: RelationalExpressionOperator.Contains,
          left: { type: RelationalExpressionLeft.Article, value: "title" },
          right: { type: RelationalExpressionRight.String, value: requiredKeyword },
        },
      ],
    };
  }

  async function storeBaseline() {
    const baselineArticle = createArticle("baseline", { title: "Baseline" });
    await inMemoryArticleFieldStore.startContext(async () => {
      await inMemoryArticleFieldStore.storeArticles("feed-1", [baselineArticle], []);
      await inMemoryArticleFieldStore.flushPendingInserts();
    });
  }

  describe("Different medium filters - same article, different outcomes", () => {
    it("returns WouldDeliver for medium without filter and FilteredByMediumFilter for medium with blocking filter", async () => {
      const article = createArticle("article-1", { title: "Tech News Update" });
      const deps = createMockDependencies();

      await storeBaseline();

      const input = createInput([article], [article], {
        mediums: [
          { id: "medium-1" }, // No filter → passes
          { id: "medium-2", filters: { expression: createBlockingFilter("SPORTS") } }, // Blocks
        ],
      });

      const { results } = await generateDeliveryPreview(input, deps);

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0]?.mediumResults.length, 2);
      assert.strictEqual(results[0]?.mediumResults[0]?.mediumId, "medium-1");
      assert.strictEqual(results[0]?.mediumResults[0]?.outcome, ArticleDeliveryOutcome.WouldDeliver);
      assert.strictEqual(results[0]?.mediumResults[1]?.mediumId, "medium-2");
      assert.strictEqual(results[0]?.mediumResults[1]?.outcome, ArticleDeliveryOutcome.FilteredByMediumFilter);
    });
  });

  describe("Different medium rate limits - same article, different outcomes", () => {
    it("returns WouldDeliver for medium under limit and RateLimitedMedium for medium over limit", async () => {
      const article = createArticle("article-1", { title: "New Article" });
      const deliveryRecordStore = createInMemoryDeliveryRecordStore();
      const deps: DeliveryPreviewDependencies = {
        articleFieldStore: inMemoryArticleFieldStore,
        deliveryRecordStore,
      };

      await storeBaseline();

      // Store 5 deliveries to BOTH mediums
      await deliveryRecordStore.startContext(async () => {
        const deliveries: ArticleDeliveryState[] = [
          ...Array.from({ length: 5 }, (_, i): ArticleDeliveryState => ({
            id: `delivery-m1-${i}`,
            mediumId: "medium-1",
            status: ArticleDeliveryStatus.Sent as const,
            articleIdHash: `hash-m1-${i}`,
            article: createArticle(`m1-${i}`),
          })),
          ...Array.from({ length: 5 }, (_, i): ArticleDeliveryState => ({
            id: `delivery-m2-${i}`,
            mediumId: "medium-2",
            status: ArticleDeliveryStatus.Sent as const,
            articleIdHash: `hash-m2-${i}`,
            article: createArticle(`m2-${i}`),
          })),
        ];
        await deliveryRecordStore.store("feed-1", deliveries);
      });

      const input = createInput([article], [article], {
        mediums: [
          { id: "medium-1", rateLimits: [{ limit: 10, timeWindowSeconds: 86400 }] }, // 5 of 10, under limit
          { id: "medium-2", rateLimits: [{ limit: 5, timeWindowSeconds: 86400 }] }, // 5 of 5, at limit
        ],
      });

      const { results } = await generateDeliveryPreview(input, deps);

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0]?.mediumResults.length, 2);
      assert.strictEqual(results[0]?.mediumResults[0]?.mediumId, "medium-1");
      assert.strictEqual(results[0]?.mediumResults[0]?.outcome, ArticleDeliveryOutcome.WouldDeliver);
      assert.strictEqual(results[0]?.mediumResults[1]?.mediumId, "medium-2");
      assert.strictEqual(results[0]?.mediumResults[1]?.outcome, ArticleDeliveryOutcome.RateLimitedMedium);
    });
  });

  describe("Mixed outcomes - three mediums with three different outcomes", () => {
    it("returns WouldDeliver, FilteredByMediumFilter, and RateLimitedMedium for same article", async () => {
      const article = createArticle("article-1", { title: "Tech News" });
      const deliveryRecordStore = createInMemoryDeliveryRecordStore();
      const deps: DeliveryPreviewDependencies = {
        articleFieldStore: inMemoryArticleFieldStore,
        deliveryRecordStore,
      };

      await storeBaseline();

      // Store 5 deliveries to medium-3 to exceed its limit
      await deliveryRecordStore.startContext(async () => {
        const deliveries: ArticleDeliveryState[] = Array.from({ length: 5 }, (_, i): ArticleDeliveryState => ({
          id: `delivery-m3-${i}`,
          mediumId: "medium-3",
          status: ArticleDeliveryStatus.Sent as const,
          articleIdHash: `hash-m3-${i}`,
          article: createArticle(`m3-${i}`),
        }));
        await deliveryRecordStore.store("feed-1", deliveries);
      });

      const input = createInput([article], [article], {
        mediums: [
          { id: "medium-1" }, // No restrictions → WouldDeliver
          { id: "medium-2", filters: { expression: createBlockingFilter("SPORTS") } }, // Filter blocks → FilteredByMediumFilter
          { id: "medium-3", rateLimits: [{ limit: 5, timeWindowSeconds: 86400 }] }, // Rate limit exceeded → RateLimitedMedium
        ],
      });

      const { results } = await generateDeliveryPreview(input, deps);

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0]?.mediumResults.length, 3);
      assert.strictEqual(results[0]?.mediumResults[0]?.mediumId, "medium-1");
      assert.strictEqual(results[0]?.mediumResults[0]?.outcome, ArticleDeliveryOutcome.WouldDeliver);
      assert.strictEqual(results[0]?.mediumResults[1]?.mediumId, "medium-2");
      assert.strictEqual(results[0]?.mediumResults[1]?.outcome, ArticleDeliveryOutcome.FilteredByMediumFilter);
      assert.strictEqual(results[0]?.mediumResults[2]?.mediumId, "medium-3");
      assert.strictEqual(results[0]?.mediumResults[2]?.outcome, ArticleDeliveryOutcome.RateLimitedMedium);
    });
  });

  describe("Filter passes but rate limit blocks", () => {
    it("returns WouldDeliver when filter passes and under limit, RateLimitedMedium when filter passes but over limit", async () => {
      const article = createArticle("article-1", { title: "Sports Update" });
      const deliveryRecordStore = createInMemoryDeliveryRecordStore();
      const deps: DeliveryPreviewDependencies = {
        articleFieldStore: inMemoryArticleFieldStore,
        deliveryRecordStore,
      };

      await storeBaseline();

      // Store 5 deliveries to medium-2 to exceed its limit
      await deliveryRecordStore.startContext(async () => {
        const deliveries: ArticleDeliveryState[] = Array.from({ length: 5 }, (_, i): ArticleDeliveryState => ({
          id: `delivery-m2-${i}`,
          mediumId: "medium-2",
          status: ArticleDeliveryStatus.Sent as const,
          articleIdHash: `hash-m2-${i}`,
          article: createArticle(`m2-${i}`),
        }));
        await deliveryRecordStore.store("feed-1", deliveries);
      });

      // Both mediums have filters that pass (title contains "Sports")
      const passingFilter = createBlockingFilter("Sports");

      const input = createInput([article], [article], {
        mediums: [
          { id: "medium-1", filters: { expression: passingFilter } }, // Filter passes, no rate limit → WouldDeliver
          { id: "medium-2", filters: { expression: passingFilter }, rateLimits: [{ limit: 5, timeWindowSeconds: 86400 }] }, // Filter passes, rate limit exceeded → RateLimitedMedium
        ],
      });

      const { results } = await generateDeliveryPreview(input, deps);

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0]?.mediumResults.length, 2);
      assert.strictEqual(results[0]?.mediumResults[0]?.mediumId, "medium-1");
      assert.strictEqual(results[0]?.mediumResults[0]?.outcome, ArticleDeliveryOutcome.WouldDeliver);
      assert.strictEqual(results[0]?.mediumResults[1]?.mediumId, "medium-2");
      assert.strictEqual(results[0]?.mediumResults[1]?.outcome, ArticleDeliveryOutcome.RateLimitedMedium);
    });
  });

  describe("Shared stage applies to all mediums", () => {
    it("returns DuplicateId for all mediums when article ID already seen", async () => {
      const article = createArticle("article-1", { title: "Test Article" });
      const deps = createMockDependencies();

      // Store the article so it's a duplicate
      await inMemoryArticleFieldStore.startContext(async () => {
        await inMemoryArticleFieldStore.storeArticles("feed-1", [article], []);
        await inMemoryArticleFieldStore.flushPendingInserts();
      });

      // Different medium configurations that would pass if not for duplicate
      const input = createInput([article], [article], {
        mediums: [
          { id: "medium-1" }, // No filter
          { id: "medium-2", filters: { expression: createBlockingFilter("Test") } }, // Filter that would pass
        ],
      });

      const { results } = await generateDeliveryPreview(input, deps);

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0]?.mediumResults.length, 2);
      // Both should have DuplicateId because shared stage applies before medium-specific stages
      assert.strictEqual(results[0]?.mediumResults[0]?.mediumId, "medium-1");
      assert.strictEqual(results[0]?.mediumResults[0]?.outcome, ArticleDeliveryOutcome.DuplicateId);
      assert.strictEqual(results[0]?.mediumResults[1]?.mediumId, "medium-2");
      assert.strictEqual(results[0]?.mediumResults[1]?.outcome, ArticleDeliveryOutcome.DuplicateId);
    });
  });

  describe("Multiple articles - results don't pollute each other", () => {
    it("each article has independent per-medium outcomes", async () => {
      // Article 1: title contains "Sports" but not "Tech"
      // Article 2: title contains "Tech" but not "Sports"
      const article1 = createArticle("article-1", { title: "Sports Update" });
      const article2 = createArticle("article-2", { title: "Tech News" });
      const deps = createMockDependencies();

      await storeBaseline();

      const sportsFilter = createBlockingFilter("Sports");
      const techFilter = createBlockingFilter("Tech");

      const input = createInput([article1, article2], [article1, article2], {
        mediums: [
          { id: "medium-1", filters: { expression: sportsFilter } }, // Requires "Sports" in title
          { id: "medium-2", filters: { expression: techFilter } }, // Requires "Tech" in title
        ],
      });

      const { results } = await generateDeliveryPreview(input, deps);

      assert.strictEqual(results.length, 2);

      // Article 1: "Sports Update"
      // - Medium-1 (Sports filter): passes → WouldDeliver
      // - Medium-2 (Tech filter): fails → FilteredByMediumFilter
      assert.strictEqual(results[0]?.articleId, "article-1");
      assert.strictEqual(results[0]?.mediumResults.length, 2);
      assert.strictEqual(results[0]?.mediumResults[0]?.mediumId, "medium-1");
      assert.strictEqual(results[0]?.mediumResults[0]?.outcome, ArticleDeliveryOutcome.WouldDeliver);
      assert.strictEqual(results[0]?.mediumResults[1]?.mediumId, "medium-2");
      assert.strictEqual(results[0]?.mediumResults[1]?.outcome, ArticleDeliveryOutcome.FilteredByMediumFilter);

      // Article 2: "Tech News"
      // - Medium-1 (Sports filter): fails → FilteredByMediumFilter
      // - Medium-2 (Tech filter): passes → WouldDeliver
      assert.strictEqual(results[1]?.articleId, "article-2");
      assert.strictEqual(results[1]?.mediumResults.length, 2);
      assert.strictEqual(results[1]?.mediumResults[0]?.mediumId, "medium-1");
      assert.strictEqual(results[1]?.mediumResults[0]?.outcome, ArticleDeliveryOutcome.FilteredByMediumFilter);
      assert.strictEqual(results[1]?.mediumResults[1]?.mediumId, "medium-2");
      assert.strictEqual(results[1]?.mediumResults[1]?.outcome, ArticleDeliveryOutcome.WouldDeliver);
    });
  });
});

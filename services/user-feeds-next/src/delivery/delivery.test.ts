import { describe, expect, it, beforeEach } from "bun:test";
import type { JobResponse } from "@synzen/discord-rest";
import type {
  JobData,
  JobResponseError,
} from "@synzen/discord-rest/dist/RESTConsumer";
import {
  processDeliveryResult,
  ArticleDeliveryStatus,
  ArticleDeliveryErrorCode,
  type DiscordDeliveryResult,
  getUnderLimitCheck,
  deliverArticles,
  type LimitState,
  createTestDiscordRestClient,
} from ".";
import { createInMemoryDeliveryRecordStore } from "../stores/in-memory/delivery-record-store";
import type { ArticleDeliveryState } from "../stores/interfaces/delivery-record-store";
import type { Article } from "../articles/parser";
import {
  ExpressionType,
  LogicalExpressionOperator,
  RelationalExpressionOperator,
  RelationalExpressionLeft,
  RelationalExpressionRight,
  type LogicalExpression,
} from "../articles/filters";

function createJobData(overrides?: Partial<JobData>): JobData {
  return {
    id: "job-123",
    route: "/webhooks/123/abc",
    options: {
      method: "POST",
      body: JSON.stringify({ content: "Hello" }),
    },
    startTimestamp: Date.now(),
    meta: {
      feedId: "feed-123",
      articleIdHash: "article-hash-123",
      mediumId: "medium-123",
    },
    ...overrides,
  };
}

function createSuccessResult(
  status: number,
  body: unknown = {}
): JobResponse<never> {
  return {
    state: "success",
    status,
    body,
  } as JobResponse<never>;
}

function createErrorResult(message: string): JobResponseError {
  return {
    state: "error",
    message,
  };
}

describe("delivery", () => {
  describe("processDeliveryResult", () => {
    describe("error state (producer-level error)", () => {
      it("returns Failed status with Internal error code", () => {
        const deliveryResult: DiscordDeliveryResult = {
          job: createJobData(),
          result: createErrorResult("Connection timeout"),
        };

        const { processed, rejectionEvent } =
          processDeliveryResult(deliveryResult);

        expect(processed.status).toBe(ArticleDeliveryStatus.Failed);
        expect(processed.errorCode).toBe(ArticleDeliveryErrorCode.Internal);
        expect(processed.internalMessage).toBe("Connection timeout");
        expect(rejectionEvent).toBeUndefined();
      });

      it("extracts metadata from job", () => {
        const deliveryResult: DiscordDeliveryResult = {
          job: createJobData({
            meta: {
              feedId: "my-feed",
              articleIdHash: "my-hash",
              mediumId: "my-medium",
              articleId: "my-article",
            },
          }),
          result: createErrorResult("Error"),
        };

        const { processed } = processDeliveryResult(deliveryResult);

        expect(processed.meta).toEqual({
          feedId: "my-feed",
          articleIdHash: "my-hash",
          mediumId: "my-medium",
          articleId: "my-article",
        });
      });
    });

    describe("400 Bad Request", () => {
      it("returns Rejected status with ThirdPartyBadRequest error code", () => {
        const deliveryResult: DiscordDeliveryResult = {
          job: createJobData(),
          result: createSuccessResult(400, {
            code: 50035,
            message: "Invalid Form Body",
          }),
        };

        const { processed } = processDeliveryResult(deliveryResult);

        expect(processed.status).toBe(ArticleDeliveryStatus.Rejected);
        expect(processed.errorCode).toBe(
          ArticleDeliveryErrorCode.ThirdPartyBadRequest
        );
      });

      it("generates badFormat rejection event", () => {
        const deliveryResult: DiscordDeliveryResult = {
          job: createJobData({
            meta: {
              feedId: "feed-1",
              articleIdHash: "hash-1",
              mediumId: "medium-1",
              articleId: "article-1",
            },
          }),
          result: createSuccessResult(400, { message: "Bad embed" }),
        };

        const { rejectionEvent } = processDeliveryResult(deliveryResult);

        expect(rejectionEvent).toBeDefined();
        expect(rejectionEvent?.type).toBe("badFormat");
        if (rejectionEvent?.type === "badFormat") {
          expect(rejectionEvent.data.feedId).toBe("feed-1");
          expect(rejectionEvent.data.mediumId).toBe("medium-1");
          expect(rejectionEvent.data.articleId).toBe("article-1");
          expect(rejectionEvent.data.responseBody).toContain("Bad embed");
        }
      });

      it("includes external detail with Discord response", () => {
        const deliveryResult: DiscordDeliveryResult = {
          job: createJobData(),
          result: createSuccessResult(400, { code: 50035 }),
        };

        const { processed } = processDeliveryResult(deliveryResult);

        expect(processed.externalDetail).toBeDefined();
        const externalDetail = JSON.parse(processed.externalDetail!);
        expect(externalDetail.type).toBe("DISCORD_RESPONSE");
        expect(externalDetail.data.responseBody).toEqual({ code: 50035 });
      });
    });

    describe("403 Forbidden", () => {
      it("returns Rejected status with ThirdPartyForbidden error code", () => {
        const deliveryResult: DiscordDeliveryResult = {
          job: createJobData(),
          result: createSuccessResult(403, { message: "Missing Access" }),
        };

        const { processed } = processDeliveryResult(deliveryResult);

        expect(processed.status).toBe(ArticleDeliveryStatus.Rejected);
        expect(processed.errorCode).toBe(
          ArticleDeliveryErrorCode.ThirdPartyForbidden
        );
      });

      it("generates missingPermissions rejection event", () => {
        const deliveryResult: DiscordDeliveryResult = {
          job: createJobData({
            meta: {
              feedId: "feed-2",
              articleIdHash: "hash-2",
              mediumId: "medium-2",
            },
          }),
          result: createSuccessResult(403, {}),
        };

        const { rejectionEvent } = processDeliveryResult(deliveryResult);

        expect(rejectionEvent).toBeDefined();
        expect(rejectionEvent?.type).toBe("missingPermissions");
        if (rejectionEvent?.type === "missingPermissions") {
          expect(rejectionEvent.data.feedId).toBe("feed-2");
          expect(rejectionEvent.data.mediumId).toBe("medium-2");
        }
      });
    });

    describe("404 Not Found", () => {
      it("returns Rejected status with ThirdPartyNotFound error code", () => {
        const deliveryResult: DiscordDeliveryResult = {
          job: createJobData(),
          result: createSuccessResult(404, { message: "Unknown Channel" }),
        };

        const { processed } = processDeliveryResult(deliveryResult);

        expect(processed.status).toBe(ArticleDeliveryStatus.Rejected);
        expect(processed.errorCode).toBe(
          ArticleDeliveryErrorCode.ThirdPartyNotFound
        );
      });

      it("generates notFound rejection event", () => {
        const deliveryResult: DiscordDeliveryResult = {
          job: createJobData({
            meta: {
              feedId: "feed-3",
              articleIdHash: "hash-3",
              mediumId: "medium-3",
            },
          }),
          result: createSuccessResult(404, {}),
        };

        const { rejectionEvent } = processDeliveryResult(deliveryResult);

        expect(rejectionEvent).toBeDefined();
        expect(rejectionEvent?.type).toBe("notFound");
        if (rejectionEvent?.type === "notFound") {
          expect(rejectionEvent.data.feedId).toBe("feed-3");
          expect(rejectionEvent.data.mediumId).toBe("medium-3");
        }
      });
    });

    describe("5xx Internal Server Error", () => {
      it("returns Failed status with ThirdPartyInternal error code for 500", () => {
        const deliveryResult: DiscordDeliveryResult = {
          job: createJobData(),
          result: createSuccessResult(500, { message: "Server error" }),
        };

        const { processed, rejectionEvent } =
          processDeliveryResult(deliveryResult);

        expect(processed.status).toBe(ArticleDeliveryStatus.Failed);
        expect(processed.errorCode).toBe(
          ArticleDeliveryErrorCode.ThirdPartyInternal
        );
        expect(rejectionEvent).toBeUndefined();
      });

      it("returns Failed status for 502", () => {
        const deliveryResult: DiscordDeliveryResult = {
          job: createJobData(),
          result: createSuccessResult(502, {}),
        };

        const { processed } = processDeliveryResult(deliveryResult);

        expect(processed.status).toBe(ArticleDeliveryStatus.Failed);
        expect(processed.errorCode).toBe(
          ArticleDeliveryErrorCode.ThirdPartyInternal
        );
      });

      it("returns Failed status for 503", () => {
        const deliveryResult: DiscordDeliveryResult = {
          job: createJobData(),
          result: createSuccessResult(503, {}),
        };

        const { processed } = processDeliveryResult(deliveryResult);

        expect(processed.status).toBe(ArticleDeliveryStatus.Failed);
        expect(processed.errorCode).toBe(
          ArticleDeliveryErrorCode.ThirdPartyInternal
        );
      });
    });

    describe("unhandled status codes", () => {
      it("returns Failed with Internal error for status < 200", () => {
        const deliveryResult: DiscordDeliveryResult = {
          job: createJobData(),
          result: createSuccessResult(100, {}),
        };

        const { processed, rejectionEvent } =
          processDeliveryResult(deliveryResult);

        expect(processed.status).toBe(ArticleDeliveryStatus.Failed);
        expect(processed.errorCode).toBe(ArticleDeliveryErrorCode.Internal);
        expect(processed.internalMessage).toContain("Unhandled status code");
        expect(rejectionEvent).toBeUndefined();
      });

      it("returns Failed with Internal error for status > 400 (non-5xx)", () => {
        const deliveryResult: DiscordDeliveryResult = {
          job: createJobData(),
          result: createSuccessResult(450, {}),
        };

        const { processed } = processDeliveryResult(deliveryResult);

        expect(processed.status).toBe(ArticleDeliveryStatus.Failed);
        expect(processed.errorCode).toBe(ArticleDeliveryErrorCode.Internal);
        expect(processed.internalMessage).toContain("Unhandled status code");
      });
    });

    describe("success (2xx status codes)", () => {
      it("returns Sent status for 200", () => {
        const deliveryResult: DiscordDeliveryResult = {
          job: createJobData(),
          result: createSuccessResult(200, { id: "msg-123" }),
        };

        const { processed, rejectionEvent } =
          processDeliveryResult(deliveryResult);

        expect(processed.status).toBe(ArticleDeliveryStatus.Sent);
        expect(processed.errorCode).toBeUndefined();
        expect(rejectionEvent).toBeUndefined();
      });

      it("returns Sent status for 201", () => {
        const deliveryResult: DiscordDeliveryResult = {
          job: createJobData(),
          result: createSuccessResult(201, {}),
        };

        const { processed } = processDeliveryResult(deliveryResult);

        expect(processed.status).toBe(ArticleDeliveryStatus.Sent);
      });

      it("returns Sent status for 204", () => {
        const deliveryResult: DiscordDeliveryResult = {
          job: createJobData(),
          result: createSuccessResult(204, {}),
        };

        const { processed } = processDeliveryResult(deliveryResult);

        expect(processed.status).toBe(ArticleDeliveryStatus.Sent);
      });

      it("extracts metadata from job", () => {
        const deliveryResult: DiscordDeliveryResult = {
          job: createJobData({
            meta: {
              feedId: "success-feed",
              articleIdHash: "success-hash",
              mediumId: "success-medium",
            },
          }),
          result: createSuccessResult(200, {}),
        };

        const { processed } = processDeliveryResult(deliveryResult);

        expect(processed.meta).toEqual({
          feedId: "success-feed",
          articleIdHash: "success-hash",
          mediumId: "success-medium",
          articleId: undefined,
        });
      });
    });

    describe("metadata handling", () => {
      it("handles missing meta in job", () => {
        const deliveryResult: DiscordDeliveryResult = {
          job: {
            id: "job-123",
            route: "/webhooks/123/abc",
            options: { method: "POST" },
            startTimestamp: Date.now(),
          } as JobData,
          result: createSuccessResult(200, {}),
        };

        const { processed } = processDeliveryResult(deliveryResult);

        expect(processed.meta).toEqual({
          feedId: "",
          articleIdHash: "",
          mediumId: "",
          articleId: undefined,
        });
      });
    });
  });

  describe("getUnderLimitCheck", () => {
    it("returns MAX_SAFE_INTEGER remaining when no limits provided", async () => {
      const store = createInMemoryDeliveryRecordStore();

      const result = await getUnderLimitCheck(store, { feedId: "feed-1" }, []);

      expect(result.underLimit).toBe(true);
      expect(result.remaining).toBe(Number.MAX_SAFE_INTEGER);
    });

    it("returns full limit when no deliveries exist", async () => {
      const store = createInMemoryDeliveryRecordStore();

      const result = await getUnderLimitCheck(store, { feedId: "feed-1" }, [
        { limit: 100, timeWindowSeconds: 86400 },
      ]);

      expect(result.underLimit).toBe(true);
      expect(result.remaining).toBe(100);
    });

    it("returns remaining based on delivery count", async () => {
      const store = createInMemoryDeliveryRecordStore();

      // Store some deliveries
      await store.startContext(async () => {
        await store.store("feed-1", [
          createDeliveryState("1", "medium-1", ArticleDeliveryStatus.Sent),
          createDeliveryState("2", "medium-1", ArticleDeliveryStatus.Sent),
          createDeliveryState("3", "medium-1", ArticleDeliveryStatus.Sent),
        ]);
      });

      const result = await getUnderLimitCheck(store, { feedId: "feed-1" }, [
        { limit: 100, timeWindowSeconds: 86400 },
      ]);

      expect(result.underLimit).toBe(true);
      expect(result.remaining).toBe(97);
    });

    it("returns 0 remaining when at limit", async () => {
      const store = createInMemoryDeliveryRecordStore();

      // Store deliveries up to limit
      await store.startContext(async () => {
        const states = Array.from({ length: 5 }, (_, i) =>
          createDeliveryState(`${i}`, "medium-1", ArticleDeliveryStatus.Sent)
        );
        await store.store("feed-1", states);
      });

      const result = await getUnderLimitCheck(store, { feedId: "feed-1" }, [
        { limit: 5, timeWindowSeconds: 86400 },
      ]);

      expect(result.underLimit).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("returns minimum remaining across multiple limits", async () => {
      const store = createInMemoryDeliveryRecordStore();

      await store.startContext(async () => {
        await store.store("feed-1", [
          createDeliveryState("1", "medium-1", ArticleDeliveryStatus.Sent),
          createDeliveryState("2", "medium-1", ArticleDeliveryStatus.Sent),
        ]);
      });

      const result = await getUnderLimitCheck(store, { feedId: "feed-1" }, [
        { limit: 100, timeWindowSeconds: 86400 }, // 98 remaining
        { limit: 5, timeWindowSeconds: 3600 }, // 3 remaining
      ]);

      expect(result.underLimit).toBe(true);
      expect(result.remaining).toBe(3); // Minimum
    });

    it("filters by mediumId when provided", async () => {
      const store = createInMemoryDeliveryRecordStore();

      await store.startContext(async () => {
        await store.store("feed-1", [
          createDeliveryState("1", "medium-1", ArticleDeliveryStatus.Sent),
          createDeliveryState("2", "medium-1", ArticleDeliveryStatus.Sent),
          createDeliveryState("3", "medium-2", ArticleDeliveryStatus.Sent),
        ]);
      });

      const result = await getUnderLimitCheck(store, { mediumId: "medium-1" }, [
        { limit: 10, timeWindowSeconds: 86400 },
      ]);

      expect(result.remaining).toBe(8); // Only 2 deliveries to medium-1
    });
  });
});

import type { DiagnosticStageResult } from "../diagnostics";

describe("diagnostic recording in delivery", () => {
  it("records FeedRateLimit diagnostic when feed rate limit is checked", async () => {
    const { startDiagnosticContext, getDiagnosticResultsForArticle, DiagnosticStage } =
      await import("../diagnostics");
    const { recordRateLimitDiagnostic } = await import(".");

    let diagnostics: DiagnosticStageResult[] = [];

    await startDiagnosticContext("test-hash", async () => {
      recordRateLimitDiagnostic({
        articleIdHash: "test-hash",
        isFeedLevel: true,
        currentCount: 15,
        limit: 20,
        timeWindowSeconds: 86400,
        remaining: 5,
      });
      diagnostics = getDiagnosticResultsForArticle("test-hash");
    });

    const rateLimitDiagnostic = diagnostics.find(
      (d) => d.stage === DiagnosticStage.FeedRateLimit
    );
    expect(rateLimitDiagnostic).toBeDefined();
    expect(rateLimitDiagnostic!.passed).toBe(true);
    expect(
      (rateLimitDiagnostic as { details: { remaining: number } }).details
        .remaining
    ).toBe(5);
  });

  it("records MediumRateLimit diagnostic when medium rate limit is checked", async () => {
    const { startDiagnosticContext, getDiagnosticResultsForArticle, DiagnosticStage } =
      await import("../diagnostics");
    const { recordRateLimitDiagnostic } = await import(".");

    let diagnostics: DiagnosticStageResult[] = [];

    await startDiagnosticContext("test-hash", async () => {
      recordRateLimitDiagnostic({
        articleIdHash: "test-hash",
        isFeedLevel: false,
        mediumId: "medium-123",
        currentCount: 8,
        limit: 10,
        timeWindowSeconds: 3600,
        remaining: 2,
      });
      diagnostics = getDiagnosticResultsForArticle("test-hash");
    });

    const rateLimitDiagnostic = diagnostics.find(
      (d) => d.stage === DiagnosticStage.MediumRateLimit
    );
    expect(rateLimitDiagnostic).toBeDefined();
    expect(rateLimitDiagnostic!.passed).toBe(true);
    expect(
      (rateLimitDiagnostic as { details: { mediumId: string } }).details.mediumId
    ).toBe("medium-123");
  });

  it("records failed rate limit diagnostic when limit exceeded", async () => {
    const { startDiagnosticContext, getDiagnosticResultsForArticle, DiagnosticStage } =
      await import("../diagnostics");
    const { recordRateLimitDiagnostic } = await import(".");

    let diagnostics: DiagnosticStageResult[] = [];

    await startDiagnosticContext("test-hash", async () => {
      recordRateLimitDiagnostic({
        articleIdHash: "test-hash",
        isFeedLevel: true,
        currentCount: 20,
        limit: 20,
        timeWindowSeconds: 86400,
        remaining: 0,
      });
      diagnostics = getDiagnosticResultsForArticle("test-hash");
    });

    const rateLimitDiagnostic = diagnostics.find(
      (d) => d.stage === DiagnosticStage.FeedRateLimit
    );
    expect(rateLimitDiagnostic).toBeDefined();
    expect(rateLimitDiagnostic!.passed).toBe(false);
    expect(
      (rateLimitDiagnostic as { details: { wouldExceed: boolean } }).details
        .wouldExceed
    ).toBe(true);
  });

  it("records MediumFilter diagnostic when filter is evaluated", async () => {
    const { startDiagnosticContext, getDiagnosticResultsForArticle, DiagnosticStage } =
      await import("../diagnostics");
    const { recordMediumFilterDiagnostic } = await import(".");

    let diagnostics: DiagnosticStageResult[] = [];

    await startDiagnosticContext("test-hash", async () => {
      recordMediumFilterDiagnostic({
        articleIdHash: "test-hash",
        mediumId: "medium-123",
        filterExpression: { type: "LOGICAL", op: "AND", children: [] },
        filterResult: true,
        explainBlocked: [],
      });
      diagnostics = getDiagnosticResultsForArticle("test-hash");
    });

    const filterDiagnostic = diagnostics.find(
      (d) => d.stage === DiagnosticStage.MediumFilter
    );
    expect(filterDiagnostic).toBeDefined();
    expect(filterDiagnostic!.passed).toBe(true);
  });

  it("records failed MediumFilter diagnostic when filter blocks article", async () => {
    const { startDiagnosticContext, getDiagnosticResultsForArticle, DiagnosticStage } =
      await import("../diagnostics");
    const { recordMediumFilterDiagnostic } = await import(".");

    let diagnostics: DiagnosticStageResult[] = [];

    await startDiagnosticContext("test-hash", async () => {
      recordMediumFilterDiagnostic({
        articleIdHash: "test-hash",
        mediumId: "medium-123",
        filterExpression: { type: "LOGICAL", op: "AND", children: [] },
        filterResult: false,
        explainBlocked: ["Title does not contain 'keyword'"],
      });
      diagnostics = getDiagnosticResultsForArticle("test-hash");
    });

    const filterDiagnostic = diagnostics.find(
      (d) => d.stage === DiagnosticStage.MediumFilter
    );
    expect(filterDiagnostic).toBeDefined();
    expect(filterDiagnostic!.passed).toBe(false);
    expect(
      (filterDiagnostic as { details: { explainBlocked: string[] } }).details
        .explainBlocked
    ).toContain("Title does not contain 'keyword'");
  });

  it("does not record diagnostics outside diagnostic context", async () => {
    const { getDiagnosticResultsForArticle } = await import("../diagnostics");
    const { recordRateLimitDiagnostic, recordMediumFilterDiagnostic } =
      await import(".");

    // Call outside diagnostic context - should not throw
    recordRateLimitDiagnostic({
      articleIdHash: "test-hash",
      isFeedLevel: true,
      currentCount: 0,
      limit: 20,
      timeWindowSeconds: 86400,
      remaining: 20,
    });

    recordMediumFilterDiagnostic({
      articleIdHash: "test-hash",
      mediumId: "medium-123",
      filterExpression: null,
      filterResult: true,
      explainBlocked: [],
    });

    const diagnostics = getDiagnosticResultsForArticle("test-hash");
    expect(diagnostics).toEqual([]);
  });
});

describe("diagnostic recording during deliverArticles execution", () => {
  it("records MediumFilter diagnostic when medium filter is evaluated during delivery", async () => {
    const { startDiagnosticContext, getDiagnosticResultsForArticle, DiagnosticStage } =
      await import("../diagnostics");
    const { deliverArticles } = await import(".");

    const store = createInMemoryDeliveryRecordStore();
    const article: Article = {
      flattened: {
        id: "article-1",
        idHash: "hash-1",
        title: "Test Article",
      },
      raw: {},
    };

    // Create a medium with a filter that will pass
    const filterExpression: LogicalExpression = {
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
    const mediumWithFilter = {
      id: "medium-filter-test",
      filters: {
        expression: filterExpression,
      },
      details: {
        guildId: "guild-123",
        channel: {
          id: "channel-123",
        },
      },
    };

    let diagnostics: DiagnosticStageResult[] = [];

    await startDiagnosticContext("hash-1", async () => {
      await store.startContext(async () => {
        await deliverArticles(
          [article],
          [mediumWithFilter],
          {
            feedId: "feed-1",
            feedUrl: "https://example.com/feed.xml",
            articleDayLimit: 100,
            discordClient: createTestDiscordRestClient(),
            deliveryRecordStore: store,
          }
        );
      });
      diagnostics = getDiagnosticResultsForArticle("hash-1");
    });

    const filterDiagnostic = diagnostics.find(
      (d) => d.stage === DiagnosticStage.MediumFilter
    );
    expect(filterDiagnostic).toBeDefined();
    expect(filterDiagnostic!.passed).toBe(true);
    expect(
      (filterDiagnostic as { details: { mediumId: string } }).details.mediumId
    ).toBe("medium-filter-test");
  });

  it("records failed MediumFilter diagnostic when filter blocks article during delivery", async () => {
    const { startDiagnosticContext, getDiagnosticResultsForArticle, DiagnosticStage } =
      await import("../diagnostics");
    const { deliverArticles } = await import(".");

    const store = createInMemoryDeliveryRecordStore();
    const article: Article = {
      flattened: {
        id: "article-1",
        idHash: "hash-1",
        title: "No Match Here",
      },
      raw: {},
    };

    // Create a medium with a filter that will NOT pass
    const blockingFilterExpression: LogicalExpression = {
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
    const mediumWithBlockingFilter = {
      id: "medium-blocking-test",
      filters: {
        expression: blockingFilterExpression,
      },
      details: {
        guildId: "guild-123",
        channel: {
          id: "channel-123",
        },
      },
    };

    let diagnostics: DiagnosticStageResult[] = [];

    await startDiagnosticContext("hash-1", async () => {
      await store.startContext(async () => {
        await deliverArticles(
          [article],
          [mediumWithBlockingFilter],
          {
            feedId: "feed-1",
            feedUrl: "https://example.com/feed.xml",
            articleDayLimit: 100,
            discordClient: createTestDiscordRestClient(),
            deliveryRecordStore: store,
          }
        );
      });
      diagnostics = getDiagnosticResultsForArticle("hash-1");
    });

    const filterDiagnostic = diagnostics.find(
      (d) => d.stage === DiagnosticStage.MediumFilter
    );
    expect(filterDiagnostic).toBeDefined();
    expect(filterDiagnostic!.passed).toBe(false);
    expect(
      (filterDiagnostic as { details: { explainBlocked: string[] } }).details
        .explainBlocked.length
    ).toBeGreaterThan(0);
  });
});

// Helper to create a delivery state for testing
function createDeliveryState(
  id: string,
  mediumId: string,
  status: ArticleDeliveryStatus
): ArticleDeliveryState {
  const article: Article = {
    flattened: {
      id: `article-${id}`,
      idHash: `hash-${id}`,
      title: `Title ${id}`,
    },
    raw: {},
  };

  if (status === ArticleDeliveryStatus.Sent) {
    return {
      id,
      mediumId,
      status: ArticleDeliveryStatus.Sent,
      articleIdHash: article.flattened.idHash,
      article,
    };
  }

  if (status === ArticleDeliveryStatus.RateLimited) {
    return {
      id,
      mediumId,
      status: ArticleDeliveryStatus.RateLimited,
      articleIdHash: article.flattened.idHash,
      article,
    };
  }

  if (status === ArticleDeliveryStatus.MediumRateLimitedByUser) {
    return {
      id,
      mediumId,
      status: ArticleDeliveryStatus.MediumRateLimitedByUser,
      articleIdHash: article.flattened.idHash,
      article,
    };
  }

  return {
    id,
    mediumId,
    status: ArticleDeliveryStatus.Sent,
    articleIdHash: article.flattened.idHash,
    article,
  };
}

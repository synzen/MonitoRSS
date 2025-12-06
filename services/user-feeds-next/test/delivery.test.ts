import { describe, expect, it } from "bun:test";
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
} from "../src/delivery";

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
});

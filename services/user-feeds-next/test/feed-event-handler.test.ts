import { describe, expect, it } from "bun:test";
import type { JobResponse } from "@synzen/discord-rest";
import type { JobResponseError } from "@synzen/discord-rest/dist/RESTConsumer";
import {
  handleArticleDeliveryResult,
  type QueuePublisher,
} from "../src/feeds/feed-event-handler";
import type { DiscordDeliveryResult } from "../src/delivery";
import { MessageBrokerQueue } from "../src/shared/constants";

function createJobData(meta?: Record<string, unknown>) {
  return {
    id: "job-123",
    route: "/webhooks/123/abc",
    options: {
      method: "POST",
      body: JSON.stringify({ content: "Hello" }),
    },
    startTimestamp: Date.now(),
    meta: meta ?? {
      feedId: "feed-123",
      articleIdHash: "article-hash-123",
      mediumId: "medium-123",
    },
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

interface PublishedMessage {
  queue: string;
  payload: { data: Record<string, unknown> };
}

function createMockPublisher(): {
  publisher: QueuePublisher;
  messages: PublishedMessage[];
} {
  const messages: PublishedMessage[] = [];
  const publisher: QueuePublisher = async (queue, message) => {
    messages.push({
      queue,
      payload: message as { data: Record<string, unknown> },
    });
  };
  return { publisher, messages };
}

describe("feed-event-handler", () => {
  describe("handleArticleDeliveryResult", () => {
    it("does not emit rejection event for successful delivery", async () => {
      const { publisher, messages } = createMockPublisher();

      const deliveryResult: DiscordDeliveryResult = {
        job: createJobData(),
        result: createSuccessResult(200, { id: "msg-123" }),
      };

      await handleArticleDeliveryResult(deliveryResult, publisher);

      expect(messages).toHaveLength(0);
    });

    it("emits badFormat rejection event for 400 response", async () => {
      const { publisher, messages } = createMockPublisher();

      const deliveryResult: DiscordDeliveryResult = {
        job: createJobData({
          feedId: "feed-400",
          articleIdHash: "hash-400",
          mediumId: "medium-400",
          articleId: "article-400",
        }),
        result: createSuccessResult(400, { code: 50035, message: "Bad embed" }),
      };

      await handleArticleDeliveryResult(deliveryResult, publisher);

      expect(messages).toHaveLength(1);
      const { queue, payload } = messages[0]!;
      expect(queue).toBe(
        MessageBrokerQueue.FeedRejectedArticleDisableConnection
      );
      expect(payload.data.rejectedCode).toBe("user-feeds/bad-request");
      expect((payload.data.feed as { id: string }).id).toBe("feed-400");
      expect((payload.data.medium as { id: string }).id).toBe("medium-400");
      expect(payload.data.articleId).toBe("article-400");
      expect(payload.data.rejectedMessage).toContain("Bad embed");
    });

    it("emits missingPermissions rejection event for 403 response", async () => {
      const { publisher, messages } = createMockPublisher();

      const deliveryResult: DiscordDeliveryResult = {
        job: createJobData({
          feedId: "feed-403",
          articleIdHash: "hash-403",
          mediumId: "medium-403",
        }),
        result: createSuccessResult(403, { message: "Missing Access" }),
      };

      await handleArticleDeliveryResult(deliveryResult, publisher);

      expect(messages).toHaveLength(1);
      const { queue, payload } = messages[0]!;
      expect(queue).toBe(
        MessageBrokerQueue.FeedRejectedArticleDisableConnection
      );
      expect(payload.data.rejectedCode).toBe("user-feeds/forbidden");
      expect((payload.data.feed as { id: string }).id).toBe("feed-403");
      expect((payload.data.medium as { id: string }).id).toBe("medium-403");
    });

    it("emits notFound rejection event for 404 response", async () => {
      const { publisher, messages } = createMockPublisher();

      const deliveryResult: DiscordDeliveryResult = {
        job: createJobData({
          feedId: "feed-404",
          articleIdHash: "hash-404",
          mediumId: "medium-404",
        }),
        result: createSuccessResult(404, { message: "Unknown Channel" }),
      };

      await handleArticleDeliveryResult(deliveryResult, publisher);

      expect(messages).toHaveLength(1);
      const { queue, payload } = messages[0]!;
      expect(queue).toBe(
        MessageBrokerQueue.FeedRejectedArticleDisableConnection
      );
      expect(payload.data.rejectedCode).toBe("user-feeds/medium-not-found");
      expect((payload.data.feed as { id: string }).id).toBe("feed-404");
      expect((payload.data.medium as { id: string }).id).toBe("medium-404");
    });

    it("does not emit rejection event for 5xx errors", async () => {
      const { publisher, messages } = createMockPublisher();

      const deliveryResult: DiscordDeliveryResult = {
        job: createJobData(),
        result: createSuccessResult(500, { message: "Internal Server Error" }),
      };

      await handleArticleDeliveryResult(deliveryResult, publisher);

      expect(messages).toHaveLength(0);
    });

    it("does not emit rejection event for error state", async () => {
      const { publisher, messages } = createMockPublisher();

      const deliveryResult: DiscordDeliveryResult = {
        job: createJobData(),
        result: createErrorResult("Connection timeout"),
      };

      await handleArticleDeliveryResult(deliveryResult, publisher);

      expect(messages).toHaveLength(0);
    });
  });
});

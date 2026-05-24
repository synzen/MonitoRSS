import { describe, it, before, after } from "node:test";
import * as assert from "node:assert";
import { randomUUID } from "crypto";
import {
  ArticleDeliveryStatus,
  ArticleDeliveryRejectedCode,
} from "../../src/delivery";
import {
  ArticleDeliveryErrorCode,
} from "../../src/stores/interfaces/delivery-record-store";
import { handleArticleDeliveryResult } from "../../src/pipeline/feed-event-handler";
import { MessageBrokerQueue } from "../../src/shared/constants";
import getTestRssFeed, { DEFAULT_TEST_ARTICLES } from "../data/test-rss-feed";
import { createTestContext } from "../helpers/test-context";
import {
  setupTestDatabase,
  teardownTestDatabase,
  type TestStores,
} from "../helpers/setup-integration-tests";

let stores: TestStores;

describe("App (e2e)", { concurrency: true }, () => {
  before(async () => {
    stores = await setupTestDatabase();
  });

  after(async () => {
    await teardownTestDatabase();
  });

  it("sends new articles based on guid", async () => {
    const ctx = createTestContext(stores);

    try {
      const seedResult = await ctx.handleEvent();
      ctx.discordClient.clear();

      ctx.setFeedResponse(() => ({
        body: getTestRssFeed(
          [{ guid: "new-article", title: "New Article Title" }],
          true
        ),
        hash: randomUUID(),
      }));

      const results = await ctx.handleEvent();

      assert.notStrictEqual(results, null);
      assert.strictEqual(results!.length, 1);
      assert.strictEqual(results![0]!.status, ArticleDeliveryStatus.PendingDelivery);
      assert.strictEqual(ctx.discordClient.capturedPayloads.length, 1);
    } finally {
      ctx.cleanup();
    }
  });

  it("does not send new articles if blocked by comparisons", async () => {
    const ctx = createTestContext(stores, {
      feedEventOverrides: {
        blockingComparisons: ["title"],
      },
    });

    try {
      await ctx.seedArticles();
      await ctx.handleEvent();

      ctx.setFeedResponse(() => ({
        body: getTestRssFeed([
          {
            guid: randomUUID(),
            title: DEFAULT_TEST_ARTICLES[0]!.title,
          },
        ]),
        hash: randomUUID(),
      }));

      const results = await ctx.handleEvent();

      assert.notStrictEqual(results, null);
      assert.strictEqual(results!.length, 0);
    } finally {
      ctx.cleanup();
    }
  });

  it("sends new articles based on passing comparisons", async () => {
    const ctx = createTestContext(stores, {
      feedEventOverrides: {
        passingComparisons: ["title"],
      },
    });

    try {
      await ctx.seedArticles();
      await ctx.handleEvent();

      ctx.setFeedResponse(() => ({
        body: getTestRssFeed(
          [
            {
              guid: DEFAULT_TEST_ARTICLES[0]!.guid,
              title: DEFAULT_TEST_ARTICLES[0]!.title + "-different",
            },
          ],
          true
        ),
        hash: randomUUID(),
      }));

      const results = await ctx.handleEvent();

      assert.notStrictEqual(results, null);
      assert.strictEqual(results!.length, 1);
      assert.strictEqual(results![0]!.status, ArticleDeliveryStatus.PendingDelivery);

      ctx.setFeedResponse(() => ({
        body: getTestRssFeed(
          [
            {
              guid: DEFAULT_TEST_ARTICLES[0]!.guid,
              title: DEFAULT_TEST_ARTICLES[0]!.title + "-different2",
            },
          ],
          true
        ),
        hash: randomUUID(),
      }));

      const results2 = await ctx.handleEvent();

      assert.notStrictEqual(results2, null);
      assert.strictEqual(results2!.length, 1);
      assert.strictEqual(results2![0]!.status, ArticleDeliveryStatus.PendingDelivery);
    } finally {
      ctx.cleanup();
    }
  });

  it("does not send new articles based on passing comparisons if there are no new articles", async () => {
    const ctx = createTestContext(stores, {
      feedEventOverrides: {
        passingComparisons: ["rss:title__#"],
      },
    });

    try {
      await ctx.seedArticles();
      await ctx.handleEvent();

      ctx.setFeedResponse(() => ({
        body: getTestRssFeed(),
        hash: randomUUID(),
      }));

      const results = await ctx.handleEvent();

      assert.notStrictEqual(results, null);
      assert.strictEqual(results!.length, 0);
    } finally {
      ctx.cleanup();
    }
  });

  it("formats HTML to Discord markdown in delivered payloads", async () => {
    const ctx = createTestContext(stores);

    const eventWithDescription = {
      ...ctx.testFeedV2Event,
      data: {
        ...ctx.testFeedV2Event.data,
        mediums: [
          {
            ...ctx.testFeedV2Event.data.mediums[0]!,
            details: {
              ...ctx.testFeedV2Event.data.mediums[0]!.details,
              content: "{{description}}",
            },
          },
        ],
      },
    };

    try {
      await ctx.seedArticles(eventWithDescription);

      ctx.setFeedResponse(() => ({
        body: getTestRssFeed([
          {
            guid: "html-article",
            description: "<strong>Bold</strong> and <em>italic</em>",
          },
        ]),
        hash: randomUUID(),
      }));

      const results = await ctx.handleEvent(eventWithDescription);

      assert.notStrictEqual(results, null);
      assert.strictEqual(results!.length, 1);
      assert.strictEqual(results![0]!.status, ArticleDeliveryStatus.PendingDelivery);

      assert.ok(ctx.discordClient.capturedPayloads.length > 0);
      const payload = JSON.parse(
        ctx.discordClient.capturedPayloads[0]!.options.body as string
      );

      assert.ok(payload.content.includes("**Bold**"));
      assert.ok(payload.content.includes("*italic*"));
      assert.ok(!payload.content.includes("<strong>"));
      assert.ok(!payload.content.includes("<em>"));
    } finally {
      ctx.cleanup();
    }
  });

  it("rejects articles and emits disable event when content resolves to empty and there are no embeds", async () => {
    const ctx = createTestContext(stores);

    const event = {
      ...ctx.testFeedV2Event,
      data: {
        ...ctx.testFeedV2Event.data,
        mediums: [
          {
            ...ctx.testFeedV2Event.data.mediums[0]!,
            details: {
              ...ctx.testFeedV2Event.data.mediums[0]!.details,
              content: "{{undefined}}",
              embeds: [],
            },
          },
        ],
      },
    };

    try {
      await ctx.seedArticles(event);

      ctx.setFeedResponse(() => ({
        body: getTestRssFeed(
          [{ guid: "new-article", title: "New Article" }],
          true
        ),
        hash: randomUUID(),
      }));

      const results = await ctx.handleEvent(event);

      assert.notStrictEqual(results, null, "Results should not be null");
      assert.ok(results!.length > 0, "Should have at least one delivery state");
      assert.strictEqual(
        results![0]!.status,
        ArticleDeliveryStatus.Rejected,
        `Expected Rejected status but got ${results![0]!.status}`
      );
      assert.strictEqual(
        results![0]!.errorCode,
        ArticleDeliveryErrorCode.NoPayloadForMedium
      );

      const calls = ctx.getQueuePublisherCalls();
      assert.strictEqual(calls.length, 1, `Expected 1 queue publish call but got ${calls.length}`);
      assert.strictEqual(
        calls[0]!.queue,
        MessageBrokerQueue.FeedRejectedArticleDisableConnection
      );
      const publishedData = (calls[0]!.message as { data: { rejectedCode: string; feed: { id: string }; medium: { id: string } } }).data;
      assert.strictEqual(publishedData.rejectedCode, ArticleDeliveryRejectedCode.BadRequest);
      assert.strictEqual(publishedData.feed.id, event.data.feed.id);
      assert.strictEqual(publishedData.medium.id, event.data.mediums[0]!.id);
    } finally {
      ctx.cleanup();
    }
  });

  it("does not silently drop articles when all payloads resolve to empty", async () => {
    const ctx = createTestContext(stores);

    const event = {
      ...ctx.testFeedV2Event,
      data: {
        ...ctx.testFeedV2Event.data,
        mediums: [
          {
            ...ctx.testFeedV2Event.data.mediums[0]!,
            details: {
              ...ctx.testFeedV2Event.data.mediums[0]!.details,
              content: "{{nonexistent}}",
              embeds: [],
            },
          },
        ],
      },
    };

    try {
      await ctx.seedArticles(event);

      ctx.setFeedResponse(() => ({
        body: getTestRssFeed(
          [{ guid: "new-article", title: "New Article" }],
          true
        ),
        hash: randomUUID(),
      }));

      const results = await ctx.handleEvent(event);

      assert.notStrictEqual(results, null, "Results should not be null");
      assert.strictEqual(
        results!.length,
        1,
        `Expected 1 delivery state but got ${results!.length}`
      );
      assert.strictEqual(
        results![0]!.status,
        ArticleDeliveryStatus.Rejected,
        "Article should be rejected, not silently dropped"
      );
    } finally {
      ctx.cleanup();
    }
  });

  it("enqueue meta includes emitDeliveryResult=true and a non-empty delivery id", async () => {
    const ctx = createTestContext(stores);

    try {
      await ctx.seedArticles();

      ctx.setFeedResponse(() => ({
        body: getTestRssFeed(
          [{ guid: "meta-check-article", title: "Meta Check" }],
          true
        ),
        hash: randomUUID(),
      }));

      const results = await ctx.handleEvent();

      assert.notStrictEqual(results, null);
      assert.ok(results!.length > 0);
      assert.strictEqual(results![0]!.status, ArticleDeliveryStatus.PendingDelivery);

      const enqueuePayload = ctx.discordClient.capturedPayloads.find(
        (p) => p.type === "enqueue"
      );
      assert.ok(enqueuePayload, "Should have an enqueue payload");
      assert.strictEqual(
        enqueuePayload!.meta!.emitDeliveryResult,
        true,
        "emitDeliveryResult must be true so discord-rest-listener publishes results"
      );
      assert.ok(
        enqueuePayload!.meta!.id && enqueuePayload!.meta!.id.length > 0,
        "delivery id must be a non-empty string"
      );
    } finally {
      ctx.cleanup();
    }
  });

  it("delivery record exists in Postgres at the moment enqueue fires", async () => {
    const ctx = createTestContext(stores);

    try {
      await ctx.seedArticles();

      ctx.setFeedResponse(() => ({
        body: getTestRssFeed(
          [{ guid: "insert-before-enqueue", title: "Insert Before Enqueue" }],
          true
        ),
        hash: randomUUID(),
      }));

      let recordFoundDuringEnqueue = false;
      ctx.discordClient.setOnEnqueue(async (meta) => {
        const { rows } = await stores.pool.query(
          `SELECT status FROM delivery_record_partitioned WHERE id = $1`,
          [meta.id]
        );
        recordFoundDuringEnqueue = !!rows[0];
      });

      const results = await ctx.handleEvent();

      assert.notStrictEqual(results, null);
      assert.ok(results!.length > 0);
      assert.strictEqual(results![0]!.status, ArticleDeliveryStatus.PendingDelivery);
      assert.strictEqual(
        recordFoundDuringEnqueue,
        true,
        "Delivery record must exist in Postgres at the moment enqueue fires — " +
          "INSERT must be flushed before publishing to RabbitMQ to prevent the " +
          "delivery result from arriving before the record exists"
      );
    } finally {
      ctx.cleanup();
    }
  });

  it("delivery lifecycle: pending record transitions to sent after simulated delivery result", async () => {
    const ctx = createTestContext(stores);

    try {
      await ctx.seedArticles();

      ctx.setFeedResponse(() => ({
        body: getTestRssFeed(
          [{ guid: "lifecycle-article", title: "Lifecycle Test" }],
          true
        ),
        hash: randomUUID(),
      }));

      const results = await ctx.handleEvent();

      assert.notStrictEqual(results, null);
      assert.ok(results!.length > 0);
      assert.strictEqual(results![0]!.status, ArticleDeliveryStatus.PendingDelivery);

      const enqueuePayload = ctx.discordClient.capturedPayloads.find(
        (p) => p.type === "enqueue"
      );
      assert.ok(enqueuePayload?.meta?.id, "enqueue must include delivery id");
      const deliveryId = enqueuePayload!.meta!.id;

      const { rows: beforeRows } = await stores.pool.query(
        `SELECT status FROM delivery_record_partitioned WHERE id = $1`,
        [deliveryId]
      );
      assert.strictEqual(
        beforeRows[0]?.status,
        "pending-delivery",
        "Record should be pending-delivery before result callback"
      );

      const noopPublisher = async () => {};
      await handleArticleDeliveryResult(
        {
          job: {
            id: "job-lifecycle",
            route: "/webhooks/123/abc",
            options: { method: "POST", body: "{}" },
            startTimestamp: Date.now(),
            meta: {
              feedId: ctx.testFeedV2Event.data.feed.id,
              mediumId: ctx.testFeedV2Event.data.mediums[0]!.id,
              articleIdHash: results![0]!.articleIdHash,
              id: deliveryId,
            },
          },
          result: { state: "success", status: 200, body: { id: "msg-123" } } as never,
        },
        noopPublisher,
        stores.deliveryRecordStore
      );

      const { rows: afterRows } = await stores.pool.query(
        `SELECT status FROM delivery_record_partitioned WHERE id = $1`,
        [deliveryId]
      );
      assert.strictEqual(
        afterRows[0]?.status,
        "sent",
        "Record should be sent after successful delivery result callback"
      );
    } finally {
      ctx.cleanup();
    }
  });
});

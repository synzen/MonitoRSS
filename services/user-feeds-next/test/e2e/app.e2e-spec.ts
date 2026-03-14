import { describe, it, before, after } from "node:test";
import * as assert from "node:assert";
import { randomUUID } from "crypto";
import {
  ArticleDeliveryStatus,
  ArticleDeliveryErrorCode,
  ArticleDeliveryRejectedCode,
} from "../../src/delivery";
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
});

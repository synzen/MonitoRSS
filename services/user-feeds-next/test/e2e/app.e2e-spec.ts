import { describe, it, before, after } from "node:test";
import * as assert from "node:assert";
import { randomUUID } from "crypto";
import { ArticleDeliveryStatus } from "../../src/delivery";
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
});

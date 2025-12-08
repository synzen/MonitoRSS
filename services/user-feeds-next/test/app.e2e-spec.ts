import { describe, it, expect } from "bun:test";
import { randomUUID } from "crypto";
import { ArticleDeliveryStatus } from "../src/delivery";
import getTestRssFeed, { DEFAULT_TEST_ARTICLES } from "./data/test-rss-feed";
import { createTestContext } from "./helpers/test-context";

// Note: Test infrastructure setup/teardown is handled by test/setup.ts (preload file)

describe("App (e2e)", () => {

  it("sends new articles based on guid", async () => {
    const ctx = createTestContext();
    console.log("APP DEBUG: feedUrl=", ctx.feedUrl, "feedId=", ctx.testFeedV2Event.data.feed.id);

    try {
      const seedResult = await ctx.handleEvent();
      console.log("APP DEBUG: seed result=", seedResult?.length);
      ctx.discordClient.clear();

      // Override fetch to return ONLY a new article (replace: true)
      // This simulates a feed where a new article appeared and old one dropped off
      ctx.setFeedResponse(() => ({
        body: getTestRssFeed(
          [{ guid: "new-article", title: "New Article Title" }],
          true
        ),
        hash: randomUUID(),
      }));

      const results = await ctx.handleEvent();
      console.log("APP DEBUG: delivery result=", results?.length);

      expect(results).not.toBeNull();
      expect(results!.length).toBe(1);
      // Channel delivery is asynchronous, so status is PendingDelivery
      expect(results![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);
      // Verify Discord API was called
      expect(ctx.discordClient.capturedPayloads.length).toBe(1);
    } finally {
      ctx.cleanup();
    }
  });

  it("does not send new articles if blocked by comparisons", async () => {
    const ctx = createTestContext({
      feedEventOverrides: {
        blockingComparisons: ["title"],
      },
    });

    try {
      await ctx.seedArticles();

      // Initialize the comparisons storage first
      await ctx.handleEvent();

      // Fetch returns article with different guid but same title as existing article
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

      expect(results).not.toBeNull();
      expect(results!.length).toBe(0);
    } finally {
      ctx.cleanup();
    }
  });

  it("sends new articles based on passing comparisons", async () => {
    const ctx = createTestContext({
      feedEventOverrides: {
        passingComparisons: ["title"],
      },
    });

    try {
      await ctx.seedArticles();

      // Initialize the comparisons storage first
      await ctx.handleEvent();

      // Fetch returns article with same guid but different title
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

      expect(results).not.toBeNull();
      expect(results!.length).toBe(1);
      // Channel delivery is asynchronous, so status is PendingDelivery
      expect(results![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);

      // Test again with another different title
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

      expect(results2).not.toBeNull();
      expect(results2!.length).toBe(1);
      // Channel delivery is asynchronous, so status is PendingDelivery
      expect(results2![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);
    } finally {
      ctx.cleanup();
    }
  });

  it("does not send new articles based on passing comparisons if there are no new articles", async () => {
    const ctx = createTestContext({
      feedEventOverrides: {
        passingComparisons: ["rss:title__#"],
      },
    });

    try {
      await ctx.seedArticles();

      // Initialize the comparisons storage first
      await ctx.handleEvent();

      // Fetch returns the same articles (no new articles, no title change)
      ctx.setFeedResponse(() => ({
        body: getTestRssFeed(),
        hash: randomUUID(),
      }));

      const results = await ctx.handleEvent();

      expect(results).not.toBeNull();
      expect(results!.length).toBe(0);
    } finally {
      ctx.cleanup();
    }
  });

  it("formats HTML to Discord markdown in delivered payloads", async () => {
    const ctx = createTestContext();

    // Modify the medium to use description instead of title
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
      // Seed with modified event
      await ctx.handleEvent(eventWithDescription);
      ctx.discordClient.clear();

      // Feed returns article with HTML content
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

      expect(results).not.toBeNull();
      expect(results!.length).toBe(1);
      // Channel delivery is asynchronous, so status is PendingDelivery
      expect(results![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);

      // Check the payload that was sent to Discord
      expect(ctx.discordClient.capturedPayloads.length).toBeGreaterThan(0);
      const payload = JSON.parse(
        ctx.discordClient.capturedPayloads[0]!.options.body as string
      );

      // Verify HTML was converted to Discord markdown
      expect(payload.content).toContain("**Bold**");
      expect(payload.content).toContain("*italic*");
      expect(payload.content).not.toContain("<strong>");
      expect(payload.content).not.toContain("<em>");
    } finally {
      ctx.cleanup();
    }
  });
});

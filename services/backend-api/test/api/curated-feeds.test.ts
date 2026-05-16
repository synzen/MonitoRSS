import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../helpers/test-context";
import { generateSnowflake } from "../helpers/test-id";
import { clearCuratedFeedsCache } from "../../src/features/curated-feeds/curated-feeds.handlers";

describe("GET /api/v1/curated-feeds", { concurrency: false }, () => {
  describe("Authentication", { concurrency: true }, () => {
    let ctx: AppTestContext;

    before(async () => {
      ctx = await createAppTestContext();
    });

    after(async () => {
      await ctx.teardown();
    });

    it("returns 401 without authentication", async () => {
      const response = await ctx.fetch("/api/v1/curated-feeds");
      assert.strictEqual(response.status, 401);
    });
  });

  describe("Empty collections", { concurrency: true }, () => {
    let ctx: AppTestContext;

    before(async () => {
      clearCuratedFeedsCache();
      ctx = await createAppTestContext();
    });

    after(async () => {
      await ctx.teardown();
    });

    it("returns empty categories and feeds when collections are empty", async () => {
      const user = await ctx.asUser(generateSnowflake());
      const response = await user.fetch("/api/v1/curated-feeds");

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: {
          categories: Array<{ id: string; label: string }>;
          feeds: Array<Record<string, unknown>>;
        };
      };

      assert.ok(body.result);
      assert.deepStrictEqual(body.result.categories, []);
      assert.deepStrictEqual(body.result.feeds, []);
    });

    it("never exposes feed urls in the response", async () => {
      const user = await ctx.asUser(generateSnowflake());
      const response = await user.fetch("/api/v1/curated-feeds");
      const body = (await response.json()) as {
        result: { feeds: Array<Record<string, unknown>> };
      };
      for (const feed of body.result.feeds) {
        assert.strictEqual(feed.url, undefined);
        assert.ok(typeof feed.id === "string");
      }
    });
  });

  describe("Default mode (no query params)", { concurrency: true }, () => {
    let ctx: AppTestContext;

    before(async () => {
      clearCuratedFeedsCache();
      ctx = await createAppTestContext();

      await ctx.container.curatedCategoryRepository.replaceAll([
        { categoryId: "gaming", label: "Gaming" },
        { categoryId: "tech", label: "Tech & Security" },
      ]);

      await ctx.container.curatedFeedRepository.replaceAll([
        {
          url: "https://example.com/gaming-popular",
          title: "Gaming News Popular",
          category: "gaming",
          domain: "example.com",
          description: "Popular gaming feed",
          popular: true,
        },
        {
          url: "https://example.com/tech-popular",
          title: "Tech Daily Popular",
          category: "tech",
          domain: "example.com",
          description: "Popular tech feed",
          popular: true,
        },
        {
          url: "https://example.com/gaming-unpopular",
          title: "Gaming Niche",
          category: "gaming",
          domain: "example.com",
          description: "Not popular",
        },
      ]);
    });

    after(async () => {
      await ctx.teardown();
    });

    it("returns only popular feeds and full category list", async () => {
      clearCuratedFeedsCache();
      const user = await ctx.asUser(generateSnowflake());
      const response = await user.fetch("/api/v1/curated-feeds");

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: {
          categories: Array<{ id: string; label: string }>;
          feeds: Array<{
            id: string;
            title: string;
            category: string;
            domain: string;
            description: string;
            popular?: boolean;
          }>;
        };
      };

      assert.strictEqual(body.result.categories.length, 2);
      assert.strictEqual(body.result.feeds.length, 2);
      assert.ok(body.result.feeds.every((f) => f.popular === true));
      assert.ok(body.result.feeds.every((f) => typeof f.id === "string"));
    });
  });

  describe("Search mode (?q)", { concurrency: true }, () => {
    let ctx: AppTestContext;

    before(async () => {
      clearCuratedFeedsCache();
      ctx = await createAppTestContext();

      await ctx.container.curatedFeedRepository.replaceAll([
        {
          url: "https://example.com/hacker-feed",
          title: "The Hacker News",
          category: "tech",
          domain: "thehackernews.com",
          description: "Cybersecurity news",
          popular: true,
        },
        {
          url: "https://example.com/other",
          title: "Cooking Daily",
          category: "food",
          domain: "cookingdaily.com",
          description: "Recipes for everyone",
        },
      ]);
    });

    after(async () => {
      await ctx.teardown();
    });

    it("returns 400 when q is shorter than 3 characters", async () => {
      const user = await ctx.asUser(generateSnowflake());
      const response = await user.fetch("/api/v1/curated-feeds?q=hi");
      assert.strictEqual(response.status, 400);
    });

    it("returns feeds matching the query across title/domain/description", async () => {
      const user = await ctx.asUser(generateSnowflake());
      const response = await user.fetch("/api/v1/curated-feeds?q=hacker");

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { feeds: Array<{ title: string }> };
      };

      assert.strictEqual(body.result.feeds.length, 1);
      assert.strictEqual(body.result.feeds[0]?.title, "The Hacker News");
    });

    it("matches case-insensitively", async () => {
      const user = await ctx.asUser(generateSnowflake());
      const response = await user.fetch("/api/v1/curated-feeds?q=HACKER");
      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { feeds: Array<{ title: string }> };
      };
      assert.strictEqual(body.result.feeds.length, 1);
    });
  });

  describe("Category mode (?category)", { concurrency: true }, () => {
    let ctx: AppTestContext;

    before(async () => {
      clearCuratedFeedsCache();
      ctx = await createAppTestContext();

      await ctx.container.curatedFeedRepository.replaceAll([
        {
          url: "https://example.com/gaming-a",
          title: "Gaming A",
          category: "gaming",
          domain: "example.com",
          description: "g a",
        },
        {
          url: "https://example.com/gaming-b",
          title: "Gaming B",
          category: "gaming",
          domain: "example.com",
          description: "g b",
        },
        {
          url: "https://example.com/tech-a",
          title: "Tech A",
          category: "tech",
          domain: "example.com",
          description: "t a",
        },
      ]);
    });

    after(async () => {
      await ctx.teardown();
    });

    it("returns only feeds in the requested category", async () => {
      const user = await ctx.asUser(generateSnowflake());
      const response = await user.fetch(
        "/api/v1/curated-feeds?category=gaming",
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { feeds: Array<{ category: string }> };
      };

      assert.strictEqual(body.result.feeds.length, 2);
      assert.ok(body.result.feeds.every((f) => f.category === "gaming"));
    });
  });

  describe("Conflicting query params", { concurrency: true }, () => {
    let ctx: AppTestContext;

    before(async () => {
      clearCuratedFeedsCache();
      ctx = await createAppTestContext();
    });

    after(async () => {
      await ctx.teardown();
    });

    it("returns 400 when both q and category are provided", async () => {
      const user = await ctx.asUser(generateSnowflake());
      const response = await user.fetch(
        "/api/v1/curated-feeds?q=hello&category=tech",
      );
      assert.strictEqual(response.status, 400);
    });
  });

  describe("Result cap", { concurrency: true }, () => {
    let ctx: AppTestContext;

    before(async () => {
      clearCuratedFeedsCache();
      ctx = await createAppTestContext();

      const feeds = Array.from({ length: 40 }, (_, i) => ({
        url: `https://example.com/feed-${i}`,
        title: `Feed ${i}`,
        category: "tech",
        domain: "example.com",
        description: "A tech feed",
        popular: true,
      }));

      await ctx.container.curatedFeedRepository.replaceAll(feeds);
    });

    after(async () => {
      await ctx.teardown();
    });

    it("caps default response at 25 feeds even when more are popular", async () => {
      clearCuratedFeedsCache();
      const user = await ctx.asUser(generateSnowflake());
      const response = await user.fetch("/api/v1/curated-feeds");
      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { feeds: unknown[] };
      };
      assert.strictEqual(body.result.feeds.length, 25);
    });

    it("returns 400 when limit exceeds 25", async () => {
      const user = await ctx.asUser(generateSnowflake());
      const response = await user.fetch("/api/v1/curated-feeds?limit=50");
      assert.strictEqual(response.status, 400);
    });
  });

  describe("Disabled feeds", { concurrency: true }, () => {
    let ctx: AppTestContext;

    before(async () => {
      clearCuratedFeedsCache();
      ctx = await createAppTestContext();

      await ctx.container.curatedFeedRepository.replaceAll([
        {
          url: "https://example.com/active-feed",
          title: "Active Feed",
          category: "tech",
          domain: "example.com",
          description: "An active feed",
          popular: true,
        },
        {
          url: "https://example.com/disabled-feed",
          title: "Disabled Feed",
          category: "tech",
          domain: "example.com",
          description: "A disabled feed",
          popular: true,
          disabled: true,
        },
      ]);
    });

    after(async () => {
      await ctx.teardown();
    });

    it("excludes disabled feeds from default response", async () => {
      clearCuratedFeedsCache();
      const user = await ctx.asUser(generateSnowflake());
      const response = await user.fetch("/api/v1/curated-feeds");

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: {
          feeds: Array<{
            id: string;
            title: string;
          }>;
        };
      };

      assert.strictEqual(body.result.feeds.length, 1);
      const feed = body.result.feeds[0];
      assert.ok(feed);
      assert.strictEqual(feed.title, "Active Feed");
      assert.ok(typeof feed.id === "string");
    });
  });
});

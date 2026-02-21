import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../helpers/test-context";
import { generateSnowflake } from "../helpers/test-id";

describe("GET /api/v1/curated-feeds", { concurrency: true }, () => {
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
  });

  describe("Seeded data", { concurrency: true }, () => {
    let ctx: AppTestContext;

    before(async () => {
      ctx = await createAppTestContext();

      await ctx.container.curatedCategoryRepository.replaceAll([
        { categoryId: "gaming", label: "Gaming" },
        { categoryId: "tech", label: "Tech & Security" },
      ]);

      await ctx.container.curatedFeedRepository.replaceAll([
        {
          url: "https://example.com/gaming-feed",
          title: "Gaming News",
          category: "gaming",
          domain: "example.com",
          description: "Latest gaming news and reviews",
          popular: true,
        },
        {
          url: "https://example.com/tech-feed",
          title: "Tech Daily",
          category: "tech",
          domain: "example.com",
          description: "Technology news and updates",
        },
      ]);
    });

    after(async () => {
      await ctx.teardown();
    });

    it("returns seeded categories and feeds", async () => {
      const user = await ctx.asUser(generateSnowflake());
      const response = await user.fetch("/api/v1/curated-feeds");

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: {
          categories: Array<{ id: string; label: string }>;
          feeds: Array<{
            url: string;
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

      const gaming = body.result.categories.find((c) => c.id === "gaming");
      assert.ok(gaming);
      assert.strictEqual(gaming.label, "Gaming");

      const tech = body.result.categories.find((c) => c.id === "tech");
      assert.ok(tech);
      assert.strictEqual(tech.label, "Tech & Security");
    });

    it("returns correct feed shape with all required fields", async () => {
      const user = await ctx.asUser(generateSnowflake());
      const response = await user.fetch("/api/v1/curated-feeds");

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: {
          categories: Array<{ id: string; label: string }>;
          feeds: Array<{
            url: string;
            title: string;
            category: string;
            domain: string;
            description: string;
            popular?: boolean;
          }>;
        };
      };

      const gamingFeed = body.result.feeds.find(
        (f) => f.url === "https://example.com/gaming-feed",
      );
      assert.ok(gamingFeed);
      assert.strictEqual(gamingFeed.title, "Gaming News");
      assert.strictEqual(gamingFeed.category, "gaming");
      assert.strictEqual(gamingFeed.domain, "example.com");
      assert.strictEqual(
        gamingFeed.description,
        "Latest gaming news and reviews",
      );
      assert.strictEqual(gamingFeed.popular, true);

      const techFeed = body.result.feeds.find(
        (f) => f.url === "https://example.com/tech-feed",
      );
      assert.ok(techFeed);
      assert.strictEqual(techFeed.title, "Tech Daily");
      assert.strictEqual(techFeed.category, "tech");
      assert.strictEqual(techFeed.domain, "example.com");
      assert.strictEqual(techFeed.description, "Technology news and updates");
      assert.strictEqual(techFeed.popular, undefined);
    });
  });

  describe("Disabled feeds", { concurrency: true }, () => {
    let ctx: AppTestContext;

    before(async () => {
      ctx = await createAppTestContext();

      await ctx.container.curatedFeedRepository.replaceAll([
        {
          url: "https://example.com/active-feed",
          title: "Active Feed",
          category: "tech",
          domain: "example.com",
          description: "An active feed",
        },
        {
          url: "https://example.com/disabled-feed",
          title: "Disabled Feed",
          category: "tech",
          domain: "example.com",
          description: "A disabled feed",
          disabled: true,
        },
      ]);
    });

    after(async () => {
      await ctx.teardown();
    });

    it("excludes disabled feeds from results", async () => {
      const user = await ctx.asUser(generateSnowflake());
      const response = await user.fetch("/api/v1/curated-feeds");

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: {
          categories: Array<{ id: string; label: string }>;
          feeds: Array<{
            url: string;
            title: string;
          }>;
        };
      };

      assert.strictEqual(body.result.feeds.length, 1);
      const feed = body.result.feeds[0];
      assert.ok(feed);
      assert.strictEqual(feed.url, "https://example.com/active-feed");
    });
  });
});

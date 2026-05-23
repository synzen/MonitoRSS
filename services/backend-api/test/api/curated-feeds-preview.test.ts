import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../helpers/test-context";
import { generateSnowflake } from "../helpers/test-id";
import {
  createTestHttpServer,
  type TestHttpServer,
} from "../helpers/test-http-server";

let ctx: AppTestContext;
let feedApiMockServer: TestHttpServer;

before(async () => {
  feedApiMockServer = createTestHttpServer();

  ctx = await createAppTestContext({
    configOverrides: {
      BACKEND_API_USER_FEEDS_API_HOST: feedApiMockServer.host,
      BACKEND_API_FEED_REQUESTS_API_HOST: feedApiMockServer.host,
    },
  });
});

after(async () => {
  await ctx.teardown();
  await feedApiMockServer.stop();
});

beforeEach(() => {
  feedApiMockServer.clear();
});

async function seedCuratedFeed(url: string): Promise<string> {
  await ctx.container.curatedFeedRepository.replaceAll([
    {
      url,
      title: "Curated",
      category: "tech",
      domain: "example.com",
      description: "A curated feed",
    },
  ]);
  const curated = await ctx.container.curatedFeedRepository.getAll();
  return curated[0]!.id;
}

describe("POST /api/v1/curated-feeds/:id/preview", () => {
  it("returns 401 without authentication", async () => {
    const response = await ctx.fetch(
      "/api/v1/curated-feeds/507f1f77bcf86cd799439011/preview",
      { method: "POST" },
    );
    assert.strictEqual(response.status, 401);
  });

  it("returns 404 when the curated feed id does not resolve", async () => {
    const user = await ctx.asUser(generateSnowflake());
    await ctx.container.curatedFeedRepository.replaceAll([]);

    const response = await user.fetch(
      "/api/v1/curated-feeds/507f1f77bcf86cd799439011/preview",
      { method: "POST" },
    );
    assert.strictEqual(response.status, 404);
  });

  it("returns 404 when the curated feed id is not a valid ObjectId", async () => {
    const user = await ctx.asUser(generateSnowflake());

    const response = await user.fetch(
      "/api/v1/curated-feeds/not-an-object-id/preview",
      { method: "POST" },
    );
    assert.strictEqual(response.status, 404);
  });

  it("returns 200 with articles when mock returns SUCCESS", async () => {
    const user = await ctx.asUser(generateSnowflake());
    const feedUrl = "https://example.com/curated-success.xml";
    const id = await seedCuratedFeed(feedUrl);

    feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "SUCCESS",
          articles: [
            {
              title: "First Article",
              date: "2025-01-15T10:00:00Z",
              link: "https://example.com/1",
            },
            {
              title: "Second Article",
              date: "2025-01-14T10:00:00Z",
              link: "https://example.com/2",
            },
          ],
          totalArticles: 2,
          selectedProperties: ["title", "date", "description", "link"],
          url: feedUrl,
        },
      },
    });

    const response = await user.fetch(`/api/v1/curated-feeds/${id}/preview`, {
      method: "POST",
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: {
        articles: Array<{ title: string; date?: string; url?: string }>;
        requestStatus: string;
      };
    };
    assert.strictEqual(body.result.requestStatus, "SUCCESS");
    assert.strictEqual(body.result.articles.length, 2);
    assert.strictEqual(body.result.articles[0]!.title, "First Article");
    assert.strictEqual(body.result.articles[0]!.date, "2025-01-15T10:00:00Z");
    assert.strictEqual(body.result.articles[0]!.url, "https://example.com/1");
    assert.strictEqual(body.result.articles[1]!.title, "Second Article");
  });

  it("accepts the request shape the frontend sends (Content-Type json, empty object body)", async () => {
    const user = await ctx.asUser(generateSnowflake());
    const feedUrl = "https://example.com/curated-json-body.xml";
    const id = await seedCuratedFeed(feedUrl);

    feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "SUCCESS",
          articles: [],
          totalArticles: 0,
          selectedProperties: [],
          url: feedUrl,
        },
      },
    });

    const response = await user.fetch(`/api/v1/curated-feeds/${id}/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    assert.strictEqual(response.status, 200);
  });

  it("returns 200 with empty articles when mock returns TIMED_OUT", async () => {
    const user = await ctx.asUser(generateSnowflake());
    const id = await seedCuratedFeed("https://example.com/slow.xml");

    feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "TIMED_OUT",
          articles: [],
          totalArticles: 0,
          selectedProperties: [],
        },
      },
    });

    const response = await user.fetch(`/api/v1/curated-feeds/${id}/preview`, {
      method: "POST",
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { articles: unknown[]; requestStatus: string };
    };
    assert.strictEqual(body.result.requestStatus, "TIMED_OUT");
    assert.strictEqual(body.result.articles.length, 0);
  });
});

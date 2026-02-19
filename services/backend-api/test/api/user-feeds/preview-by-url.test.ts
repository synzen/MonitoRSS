import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../../helpers/test-context";
import { generateSnowflake } from "../../helpers/test-id";
import {
  createTestHttpServer,
  type TestHttpServer,
} from "../../helpers/test-http-server";

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

describe("POST /api/v1/user-feeds/preview-by-url", () => {
  it("returns 401 without authentication", async () => {
    const response = await ctx.fetch("/api/v1/user-feeds/preview-by-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/feed.xml" }),
    });
    assert.strictEqual(response.status, 401);
  });

  it("returns 400 when url is missing from body", async () => {
    const user = await ctx.asUser(generateSnowflake());

    const response = await user.fetch("/api/v1/user-feeds/preview-by-url", {
      method: "POST",
      body: JSON.stringify({}),
    });
    assert.strictEqual(response.status, 400);
  });

  it("returns 400 when url is empty string", async () => {
    const user = await ctx.asUser(generateSnowflake());

    const response = await user.fetch("/api/v1/user-feeds/preview-by-url", {
      method: "POST",
      body: JSON.stringify({ url: "" }),
    });
    assert.strictEqual(response.status, 400);
  });

  it("returns 200 with articles when mock returns SUCCESS", async () => {
    const user = await ctx.asUser(generateSnowflake());
    const feedUrl = "https://example.com/feed.xml";

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

    const response = await user.fetch("/api/v1/user-feeds/preview-by-url", {
      method: "POST",
      body: JSON.stringify({ url: feedUrl }),
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

  it("returns 200 with empty articles when mock returns TIMED_OUT", async () => {
    const user = await ctx.asUser(generateSnowflake());

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

    const response = await user.fetch("/api/v1/user-feeds/preview-by-url", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/slow.xml" }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { articles: unknown[]; requestStatus: string };
    };
    assert.strictEqual(body.result.requestStatus, "TIMED_OUT");
    assert.strictEqual(body.result.articles.length, 0);
  });

  it("returns 200 with empty articles when mock returns PARSE_ERROR", async () => {
    const user = await ctx.asUser(generateSnowflake());

    feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "PARSE_ERROR",
          articles: [],
          totalArticles: 0,
          selectedProperties: [],
        },
      },
    });

    const response = await user.fetch("/api/v1/user-feeds/preview-by-url", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/bad.xml" }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { articles: unknown[]; requestStatus: string };
    };
    assert.strictEqual(body.result.requestStatus, "PARSE_ERROR");
    assert.strictEqual(body.result.articles.length, 0);
  });

  it("returns 200 with empty articles when mock returns FETCH_ERROR", async () => {
    const user = await ctx.asUser(generateSnowflake());

    feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "FETCH_ERROR",
          articles: [],
          totalArticles: 0,
          selectedProperties: [],
        },
      },
    });

    const response = await user.fetch("/api/v1/user-feeds/preview-by-url", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/error.xml" }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { articles: unknown[]; requestStatus: string };
    };
    assert.strictEqual(body.result.requestStatus, "FETCH_ERROR");
    assert.strictEqual(body.result.articles.length, 0);
  });

  it("uses description as title fallback when title is missing", async () => {
    const user = await ctx.asUser(generateSnowflake());

    feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "SUCCESS",
          articles: [
            {
              description: "This is a description used as title",
              date: "2025-01-15T10:00:00Z",
            },
          ],
          totalArticles: 1,
          selectedProperties: ["title", "date", "description", "link"],
        },
      },
    });

    const response = await user.fetch("/api/v1/user-feeds/preview-by-url", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/no-title.xml" }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: {
        articles: Array<{ title: string }>;
        requestStatus: string;
      };
    };
    assert.strictEqual(
      body.result.articles[0]!.title,
      "This is a description used as title",
    );
  });

  it("truncates long description used as title fallback", async () => {
    const user = await ctx.asUser(generateSnowflake());
    const longDescription = "A".repeat(100);

    feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "SUCCESS",
          articles: [{ description: longDescription }],
          totalArticles: 1,
          selectedProperties: ["title", "date", "description", "link"],
        },
      },
    });

    const response = await user.fetch("/api/v1/user-feeds/preview-by-url", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/long-desc.xml" }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { articles: Array<{ title: string }> };
    };
    assert.strictEqual(body.result.articles[0]!.title, "A".repeat(80) + "...");
  });

  it("uses link path segment as title when title and description missing", async () => {
    const user = await ctx.asUser(generateSnowflake());

    feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "SUCCESS",
          articles: [{ link: "https://example.com/articles/my-cool-post" }],
          totalArticles: 1,
          selectedProperties: ["title", "date", "description", "link"],
        },
      },
    });

    const response = await user.fetch("/api/v1/user-feeds/preview-by-url", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/no-title-desc.xml" }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { articles: Array<{ title: string }> };
    };
    assert.strictEqual(body.result.articles[0]!.title, "my-cool-post");
  });

  it("returns 'Untitled article' when nothing is available", async () => {
    const user = await ctx.asUser(generateSnowflake());

    feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "SUCCESS",
          articles: [{}],
          totalArticles: 1,
          selectedProperties: ["title", "date", "description", "link"],
        },
      },
    });

    const response = await user.fetch("/api/v1/user-feeds/preview-by-url", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/empty-article.xml" }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { articles: Array<{ title: string }> };
    };
    assert.strictEqual(body.result.articles[0]!.title, "Untitled article");
  });

  it("omits date field when not present in article", async () => {
    const user = await ctx.asUser(generateSnowflake());

    feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "SUCCESS",
          articles: [{ title: "No Date Article" }],
          totalArticles: 1,
          selectedProperties: ["title", "date", "description", "link"],
        },
      },
    });

    const response = await user.fetch("/api/v1/user-feeds/preview-by-url", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/no-date.xml" }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { articles: Array<{ title: string; date?: string }> };
    };
    assert.strictEqual(body.result.articles[0]!.title, "No Date Article");
    assert.strictEqual(body.result.articles[0]!.date, undefined);
  });

  it("returns empty articles array when totalArticles is 0", async () => {
    const user = await ctx.asUser(generateSnowflake());

    feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "SUCCESS",
          articles: [],
          totalArticles: 0,
          selectedProperties: ["title", "date", "description", "link"],
        },
      },
    });

    const response = await user.fetch("/api/v1/user-feeds/preview-by-url", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/empty-feed.xml" }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { articles: unknown[]; requestStatus: string };
    };
    assert.strictEqual(body.result.requestStatus, "SUCCESS");
    assert.strictEqual(body.result.articles.length, 0);
  });

  it("sorts articles with dates before dateless articles", async () => {
    const user = await ctx.asUser(generateSnowflake());

    feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "SUCCESS",
          articles: [
            { title: "No Date" },
            { title: "Old", date: "2025-01-10T10:00:00Z" },
            { title: "New", date: "2025-01-15T10:00:00Z" },
          ],
          totalArticles: 3,
          selectedProperties: ["title", "date", "description", "link"],
        },
      },
    });

    const response = await user.fetch("/api/v1/user-feeds/preview-by-url", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/mixed-dates.xml" }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { articles: Array<{ title: string; date?: string }> };
    };
    assert.strictEqual(body.result.articles[0]!.title, "New");
    assert.strictEqual(body.result.articles[1]!.title, "Old");
    assert.strictEqual(body.result.articles[2]!.title, "No Date");
  });
});

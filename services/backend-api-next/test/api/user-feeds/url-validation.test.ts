import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../../helpers/test-context";
import { generateSnowflake, generateTestId } from "../../helpers/test-id";
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

describe("POST /api/v1/user-feeds/url-validation", () => {
  it("returns 401 without authentication", async () => {
    const response = await ctx.fetch("/api/v1/user-feeds/url-validation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/feed.xml" }),
    });
    assert.strictEqual(response.status, 401);
  });

  it("returns 400 when url is missing from body", async () => {
    const user = await ctx.asUser(generateSnowflake());

    const response = await user.fetch("/api/v1/user-feeds/url-validation", {
      method: "POST",
      body: JSON.stringify({}),
    });
    assert.strictEqual(response.status, 400);
  });

  it("returns 400 when url is empty string", async () => {
    const user = await ctx.asUser(generateSnowflake());

    const response = await user.fetch("/api/v1/user-feeds/url-validation", {
      method: "POST",
      body: JSON.stringify({ url: "" }),
    });
    assert.strictEqual(response.status, 400);
  });

  it("returns 200 with resolvedToUrl null and feedTitle when URL is valid", async () => {
    const user = await ctx.asUser(generateSnowflake());
    const feedUrl = "https://example.com/feed.xml";

    feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "SUCCESS",
          articles: [],
          totalArticles: 0,
          selectedProperties: [],
          url: feedUrl,
          feedTitle: "My Test Feed",
        },
      },
    });

    const response = await user.fetch("/api/v1/user-feeds/url-validation", {
      method: "POST",
      body: JSON.stringify({ url: feedUrl }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { resolvedToUrl: string | null; feedTitle?: string };
    };
    assert.strictEqual(body.result.resolvedToUrl, null);
    assert.strictEqual(body.result.feedTitle, "My Test Feed");
  });

  it("returns 200 with resolvedToUrl when URL redirects to different URL", async () => {
    const user = await ctx.asUser(generateSnowflake());
    const inputUrl = "https://example.com/page.html";
    const resolvedUrl = "https://example.com/discovered-feed.xml";

    feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "SUCCESS",
          articles: [],
          totalArticles: 0,
          selectedProperties: [],
          url: resolvedUrl,
          feedTitle: "Discovered Feed",
        },
      },
    });

    const response = await user.fetch("/api/v1/user-feeds/url-validation", {
      method: "POST",
      body: JSON.stringify({ url: inputUrl }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { resolvedToUrl: string | null; feedTitle?: string };
    };
    assert.strictEqual(body.result.resolvedToUrl, resolvedUrl);
    assert.strictEqual(body.result.feedTitle, undefined);
  });

  it("returns 400 with FEED_REQUEST_TIMEOUT when feed fetch times out", async () => {
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

    const response = await user.fetch("/api/v1/user-feeds/url-validation", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/slow-feed.xml" }),
    });

    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "FEED_REQUEST_TIMEOUT");
  });

  it("returns 400 with ADD_FEED_PARSE_FAILED when feed cannot be parsed", async () => {
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

    const response = await user.fetch("/api/v1/user-feeds/url-validation", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/bad-feed.xml" }),
    });

    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "ADD_FEED_PARSE_FAILED");
  });

  it("returns 400 with FEED_INVALID_SSL_CERT when SSL certificate is invalid", async () => {
    const user = await ctx.asUser(generateSnowflake());

    feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "INVALID_SSL_CERTIFICATE",
          articles: [],
          totalArticles: 0,
          selectedProperties: [],
        },
      },
    });

    const response = await user.fetch("/api/v1/user-feeds/url-validation", {
      method: "POST",
      body: JSON.stringify({ url: "https://bad-ssl.example.com/feed.xml" }),
    });

    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "FEED_INVALID_SSL_CERT");
  });

  it("returns 400 with NO_FEED_IN_HTML_PAGE when HTML page has no feed", async () => {
    const user = await ctx.asUser(generateSnowflake());

    feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "PARSE_ERROR",
          attemptedToResolveFromHtml: true,
          articles: [],
          totalArticles: 0,
          selectedProperties: [],
        },
      },
    });

    const response = await user.fetch("/api/v1/user-feeds/url-validation", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/page.html" }),
    });

    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "NO_FEED_IN_HTML_PAGE");
  });

  it("returns 400 with FEED_FETCH_FAILED when feed request fails", async () => {
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

    const response = await user.fetch("/api/v1/user-feeds/url-validation", {
      method: "POST",
      body: JSON.stringify({ url: "https://unreachable.example.com/feed.xml" }),
    });

    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "FEED_FETCH_FAILED");
  });

  it("returns 400 with FEED_REQUEST_TOO_MANY_REQUESTS when feed returns 429", async () => {
    const user = await ctx.asUser(generateSnowflake());

    feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "BAD_STATUS_CODE",
          response: { statusCode: 429 },
          articles: [],
          totalArticles: 0,
          selectedProperties: [],
        },
      },
    });

    const response = await user.fetch("/api/v1/user-feeds/url-validation", {
      method: "POST",
      body: JSON.stringify({ url: "https://ratelimited.example.com/feed.xml" }),
    });

    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "FEED_REQUEST_TOO_MANY_REQUESTS");
  });

  it("returns 400 with FEED_NOT_FOUND when feed returns 404", async () => {
    const user = await ctx.asUser(generateSnowflake());

    feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "BAD_STATUS_CODE",
          response: { statusCode: 404 },
          articles: [],
          totalArticles: 0,
          selectedProperties: [],
        },
      },
    });

    const response = await user.fetch("/api/v1/user-feeds/url-validation", {
      method: "POST",
      body: JSON.stringify({ url: "https://notfound.example.com/feed.xml" }),
    });

    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "FEED_NOT_FOUND");
  });

  it("returns 400 with BANNED_FEED when feed is banned", async () => {
    const user = await ctx.asUser(generateSnowflake());
    const feedUrl = "https://example.com/banned-validation-feed.xml";

    feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "SUCCESS",
          articles: [],
          totalArticles: 0,
          selectedProperties: [],
          url: feedUrl,
          feedTitle: "Banned Feed",
        },
      },
    });

    await ctx.container.bannedFeedRepository.create({
      url: feedUrl,
      reason: "Test ban",
      guildIds: [],
    });

    const response = await user.fetch("/api/v1/user-feeds/url-validation", {
      method: "POST",
      body: JSON.stringify({ url: feedUrl }),
    });

    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "BANNED_FEED");
  });
});

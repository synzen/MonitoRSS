import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../../helpers/test-context";
import { createMockAccessToken } from "../../helpers/mock-factories";
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

describe("POST /api/v1/user-feeds", () => {
  it("returns 401 without authentication", async () => {
    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/feed.xml" }),
    });
    assert.strictEqual(response.status, 401);
  });

  it("returns 400 when url is missing from body", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({}),
    });
    assert.strictEqual(response.status, 400);
  });

  it("returns 400 when url is empty string", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ url: "" }),
    });
    assert.strictEqual(response.status, 400);
  });

  it("returns 201 with valid feed data when successful", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);
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

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ url: feedUrl }),
    });

    assert.strictEqual(response.status, 201);
    const body = (await response.json()) as {
      result: {
        id: string;
        title: string;
        url: string;
        connections: unknown[];
        createdAt: string;
        updatedAt: string;
      };
    };
    assert.ok(body.result);
    assert.ok(body.result.id);
    assert.strictEqual(body.result.url, feedUrl);
    assert.strictEqual(body.result.title, "My Test Feed");
    assert.ok(Array.isArray(body.result.connections));
    assert.ok(body.result.createdAt);
    assert.ok(body.result.updatedAt);
  });

  it("returns 400 with FEED_LIMIT_REACHED when user has too many feeds", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "SUCCESS",
          articles: [],
          totalArticles: 0,
          selectedProperties: [],
          url: "https://example.com/feed.xml",
          feedTitle: "Feed",
        },
      },
    });

    const maxFeeds = ctx.container.config.BACKEND_API_DEFAULT_MAX_USER_FEEDS;
    for (let i = 0; i < maxFeeds; i++) {
      await ctx.container.userFeedRepository.create({
        title: `Feed ${i}`,
        url: `https://example.com/feed-${i}.xml`,
        user: { id: generateTestId(), discordUserId },
      });
    }

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ url: "https://example.com/new-feed.xml" }),
    });

    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "FEED_LIMIT_REACHED");
  });

  it("returns 400 with FEED_REQUEST_TIMEOUT when feed fetch times out", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

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

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ url: "https://example.com/slow-feed.xml" }),
    });

    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "FEED_REQUEST_TIMEOUT");
  });

  it("returns 400 with ADD_FEED_PARSE_FAILED when feed cannot be parsed", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

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

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ url: "https://example.com/bad-feed.xml" }),
    });

    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "ADD_FEED_PARSE_FAILED");
  });

  it("returns 201 with custom title when title is provided", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);
    const feedUrl = "https://example.com/feed.xml";
    const customTitle = "My Custom Feed Title";

    feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "SUCCESS",
          articles: [],
          totalArticles: 0,
          selectedProperties: [],
          url: feedUrl,
          feedTitle: "Original Title From Feed",
        },
      },
    });

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ url: feedUrl, title: customTitle }),
    });

    assert.strictEqual(response.status, 201);
    const body = (await response.json()) as {
      result: { title: string };
    };
    assert.strictEqual(body.result.title, customTitle);
  });

  it("returns 201 with 'Untitled Feed' when no title and no feedTitle from API", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);
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
        },
      },
    });

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ url: feedUrl }),
    });

    assert.strictEqual(response.status, 201);
    const body = (await response.json()) as {
      result: { title: string };
    };
    assert.strictEqual(body.result.title, "Untitled Feed");
  });

  it("preserves inputUrl when feed URL resolves differently", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);
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

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ url: inputUrl }),
    });

    assert.strictEqual(response.status, 201);
    const body = (await response.json()) as {
      result: { url: string; inputUrl: string };
    };
    assert.strictEqual(body.result.url, resolvedUrl);
    assert.strictEqual(body.result.inputUrl, inputUrl);
  });

  it("returns 400 with ADD_FEED_WITH_SOURCE_FEED_NOT_FOUND when sourceFeedId does not exist", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);
    const nonExistentFeedId = generateTestId();

    feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "SUCCESS",
          articles: [],
          totalArticles: 0,
          selectedProperties: [],
          url: "https://example.com/feed.xml",
          feedTitle: "Feed",
        },
      },
    });

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        url: "https://example.com/new-feed.xml",
        sourceFeedId: nonExistentFeedId,
      }),
    });

    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "ADD_FEED_WITH_SOURCE_FEED_NOT_FOUND");
  });

  it("returns 400 with ADD_FEED_WITH_SOURCE_FEED_NOT_FOUND when sourceFeedId belongs to another user", async () => {
    const otherUserDiscordId = generateSnowflake();
    const currentUserDiscordId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(currentUserDiscordId);
    const cookies = await ctx.setSession(mockAccessToken);

    const existingFeed = await ctx.container.userFeedRepository.create({
      title: "Other User's Feed",
      url: "https://example.com/other-feed.xml",
      user: { id: generateTestId(), discordUserId: otherUserDiscordId },
    });

    feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "SUCCESS",
          articles: [],
          totalArticles: 0,
          selectedProperties: [],
          url: "https://example.com/feed.xml",
          feedTitle: "Feed",
        },
      },
    });

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        url: "https://example.com/new-feed.xml",
        sourceFeedId: existingFeed.id,
      }),
    });

    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "ADD_FEED_WITH_SOURCE_FEED_NOT_FOUND");
  });

  it("copies settings from sourceFeed when sourceFeedId is provided", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const sourceFeed = await ctx.container.userFeedRepository.create({
      title: "Source Feed",
      url: "https://example.com/source-feed.xml",
      user: { id: generateTestId(), discordUserId },
      passingComparisons: ["title", "link"],
      blockingComparisons: ["author"],
      formatOptions: {
        dateFormat: "YYYY-MM-DD",
        dateTimezone: "America/New_York",
      },
    });

    feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "SUCCESS",
          articles: [],
          totalArticles: 0,
          selectedProperties: [],
          url: "https://example.com/new-feed.xml",
          feedTitle: "New Feed",
        },
      },
    });

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        url: "https://example.com/new-feed.xml",
        sourceFeedId: sourceFeed.id,
      }),
    });

    assert.strictEqual(response.status, 201);
    const body = (await response.json()) as {
      result: {
        passingComparisons: string[];
        blockingComparisons: string[];
        formatOptions: { dateFormat: string; dateTimezone: string };
      };
    };
    assert.deepStrictEqual(body.result.passingComparisons, ["title", "link"]);
    assert.deepStrictEqual(body.result.blockingComparisons, ["author"]);
    assert.strictEqual(body.result.formatOptions.dateFormat, "YYYY-MM-DD");
    assert.strictEqual(
      body.result.formatOptions.dateTimezone,
      "America/New_York",
    );
  });

  it("returns 400 with BANNED_FEED when feed is banned", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);
    const feedUrl = "https://example.com/banned-feed.xml";

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

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ url: feedUrl }),
    });

    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "BANNED_FEED");
  });

  it("returns 400 with FEED_INVALID_SSL_CERT when SSL certificate is invalid", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

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

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ url: "https://bad-ssl.example.com/feed.xml" }),
    });

    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "FEED_INVALID_SSL_CERT");
  });

  it("returns 400 with NO_FEED_IN_HTML_PAGE when HTML page has no feed", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

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

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ url: "https://example.com/page.html" }),
    });

    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "NO_FEED_IN_HTML_PAGE");
  });

  it("returns 400 with FEED_FETCH_FAILED when feed request fails", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

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

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ url: "https://unreachable.example.com/feed.xml" }),
    });

    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "FEED_FETCH_FAILED");
  });

  it("returns 400 with FEED_REQUEST_TOO_MANY_REQUESTS when feed returns 429", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

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

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ url: "https://ratelimited.example.com/feed.xml" }),
    });

    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "FEED_REQUEST_TOO_MANY_REQUESTS");
  });

  it("returns 400 with FEED_REQUEST_UNAUTHORIZED when feed returns 401", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

    feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "BAD_STATUS_CODE",
          response: { statusCode: 401 },
          articles: [],
          totalArticles: 0,
          selectedProperties: [],
        },
      },
    });

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ url: "https://protected.example.com/feed.xml" }),
    });

    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "FEED_REQUEST_UNAUTHORIZED");
  });

  it("returns 400 with FEED_REQUEST_FORBIDDEN when feed returns 403", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

    feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "BAD_STATUS_CODE",
          response: { statusCode: 403 },
          articles: [],
          totalArticles: 0,
          selectedProperties: [],
        },
      },
    });

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ url: "https://forbidden.example.com/feed.xml" }),
    });

    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "FEED_REQUEST_FORBIDDEN");
  });

  it("returns 400 with FEED_REQUEST_INTERNAL_ERROR when feed returns 5xx", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

    feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "BAD_STATUS_CODE",
          response: { statusCode: 500 },
          articles: [],
          totalArticles: 0,
          selectedProperties: [],
        },
      },
    });

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ url: "https://error.example.com/feed.xml" }),
    });

    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "FEED_REQUEST_INTERNAL_ERROR");
  });

  it("returns 400 with FEED_NOT_FOUND when feed returns 404", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

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

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ url: "https://notfound.example.com/feed.xml" }),
    });

    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "FEED_NOT_FOUND");
  });

  it("sets dateCheckOptions when feed has articles with dates", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);
    const feedUrl = "https://example.com/feed-with-dates.xml";

    feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "SUCCESS",
          articles: [
            {
              id: "article-1",
              title: "Article with date",
              date: "2024-01-15T12:00:00Z",
            },
          ],
          totalArticles: 1,
          selectedProperties: ["date"],
          url: feedUrl,
          feedTitle: "Feed With Dates",
        },
      },
    });

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ url: feedUrl }),
    });

    assert.strictEqual(response.status, 201);
    const body = (await response.json()) as {
      result: {
        dateCheckOptions: { oldArticleDateDiffMsThreshold: number };
      };
    };
    assert.ok(body.result.dateCheckOptions);
    assert.strictEqual(
      body.result.dateCheckOptions.oldArticleDateDiffMsThreshold,
      86400000,
    );
  });

  it("does not set dateCheckOptions when feed has no articles with dates", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);
    const feedUrl = "https://example.com/feed-no-dates.xml";

    feedApiMockServer.registerRoute("POST", "/v1/user-feeds/get-articles", {
      status: 200,
      body: {
        result: {
          requestStatus: "SUCCESS",
          articles: [{ id: "article-1", title: "Article without date" }],
          totalArticles: 1,
          selectedProperties: [],
          url: feedUrl,
          feedTitle: "Feed Without Dates",
        },
      },
    });

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ url: feedUrl }),
    });

    assert.strictEqual(response.status, 201);
    const body = (await response.json()) as {
      result: {
        dateCheckOptions?: { oldArticleDateDiffMsThreshold: number };
      };
    };
    assert.strictEqual(body.result.dateCheckOptions, undefined);
  });

  it("returns response with expected structure and fields", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);
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
          feedTitle: "Test Feed",
        },
      },
    });

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ url: feedUrl }),
    });

    assert.strictEqual(response.status, 201);
    const body = (await response.json()) as {
      result: Record<string, unknown>;
    };

    assert.ok(body.result.id, "Response should have id");
    assert.ok(body.result.title, "Response should have title");
    assert.ok(body.result.url, "Response should have url");
    assert.ok(
      Array.isArray(body.result.connections),
      "Response should have connections array",
    );
    assert.ok(body.result.createdAt, "Response should have createdAt");
    assert.ok(body.result.updatedAt, "Response should have updatedAt");
    assert.ok(body.result.healthStatus, "Response should have healthStatus");
    assert.ok(
      body.result.refreshRateSeconds !== undefined,
      "Response should have refreshRateSeconds",
    );
    assert.ok(
      Array.isArray(body.result.refreshRateOptions),
      "Response should have refreshRateOptions array",
    );
  });
});

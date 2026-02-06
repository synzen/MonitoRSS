import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../helpers/test-context";
import { createMockAccessToken } from "../helpers/mock-factories";
import { generateSnowflake, generateTestId } from "../helpers/test-id";
import {
  createTestHttpServer,
  type TestHttpServer,
} from "../helpers/test-http-server";
import {
  UserFeedDisabledCode,
  UserFeedManagerStatus,
} from "../../src/repositories/shared/enums";

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
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch("/api/v1/user-feeds/url-validation", {
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

    const response = await ctx.fetch("/api/v1/user-feeds/url-validation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ url: "" }),
    });
    assert.strictEqual(response.status, 400);
  });

  it("returns 200 with resolvedToUrl null and feedTitle when URL is valid", async () => {
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

    const response = await ctx.fetch("/api/v1/user-feeds/url-validation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
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

    const response = await ctx.fetch("/api/v1/user-feeds/url-validation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
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

    const response = await ctx.fetch("/api/v1/user-feeds/url-validation", {
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

    const response = await ctx.fetch("/api/v1/user-feeds/url-validation", {
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

    const response = await ctx.fetch("/api/v1/user-feeds/url-validation", {
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

    const response = await ctx.fetch("/api/v1/user-feeds/url-validation", {
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

    const response = await ctx.fetch("/api/v1/user-feeds/url-validation", {
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

    const response = await ctx.fetch("/api/v1/user-feeds/url-validation", {
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

    const response = await ctx.fetch("/api/v1/user-feeds/url-validation", {
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

  it("returns 400 with BANNED_FEED when feed is banned", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);
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

    const response = await ctx.fetch("/api/v1/user-feeds/url-validation", {
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
});

describe("POST /api/v1/user-feeds/deduplicate-feed-urls", () => {
  it("returns 401 without authentication", async () => {
    const response = await ctx.fetch(
      "/api/v1/user-feeds/deduplicate-feed-urls",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: ["https://example.com/feed.xml"] }),
      },
    );
    assert.strictEqual(response.status, 401);
  });

  it("returns 400 when urls field is missing", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch(
      "/api/v1/user-feeds/deduplicate-feed-urls",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: cookies,
        },
        body: JSON.stringify({}),
      },
    );
    assert.strictEqual(response.status, 400);
  });

  it("returns deduplicated URLs (filters out existing)", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    await ctx.container.userFeedRepository.create({
      title: "Existing Feed",
      url: "https://example.com/existing-feed.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(
      "/api/v1/user-feeds/deduplicate-feed-urls",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: cookies,
        },
        body: JSON.stringify({
          urls: [
            "https://example.com/existing-feed.xml",
            "https://example.com/new-feed.xml",
          ],
        }),
      },
    );

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as { result: { urls: string[] } };
    assert.deepStrictEqual(body.result.urls, [
      "https://example.com/new-feed.xml",
    ]);
  });

  it("returns all URLs if none exist in user's feeds", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch(
      "/api/v1/user-feeds/deduplicate-feed-urls",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: cookies,
        },
        body: JSON.stringify({
          urls: [
            "https://example.com/feed1.xml",
            "https://example.com/feed2.xml",
          ],
        }),
      },
    );

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as { result: { urls: string[] } };
    assert.deepStrictEqual(body.result.urls, [
      "https://example.com/feed1.xml",
      "https://example.com/feed2.xml",
    ]);
  });

  it("returns empty array if all URLs already exist", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    await ctx.container.userFeedRepository.create({
      title: "Feed 1",
      url: "https://example.com/feed1.xml",
      user: { id: generateTestId(), discordUserId },
    });

    await ctx.container.userFeedRepository.create({
      title: "Feed 2",
      url: "https://example.com/feed2.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(
      "/api/v1/user-feeds/deduplicate-feed-urls",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: cookies,
        },
        body: JSON.stringify({
          urls: [
            "https://example.com/feed1.xml",
            "https://example.com/feed2.xml",
          ],
        }),
      },
    );

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as { result: { urls: string[] } };
    assert.deepStrictEqual(body.result.urls, []);
  });
});

describe("PATCH /api/v1/user-feeds", () => {
  it("returns 401 without authentication", async () => {
    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        op: "bulk-delete",
        data: { feeds: [{ id: "feed-1" }] },
      }),
    });
    assert.strictEqual(response.status, 401);
  });

  it("returns 400 when op is missing", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        data: { feeds: [{ id: "feed-1" }] },
      }),
    });
    assert.strictEqual(response.status, 400);
  });

  it("returns 400 when data is missing", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        op: "bulk-delete",
      }),
    });
    assert.strictEqual(response.status, 400);
  });

  it("returns 400 when data.feeds is missing", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        op: "bulk-delete",
        data: {},
      }),
    });
    assert.strictEqual(response.status, 400);
  });

  it("returns 400 when op is invalid value", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        op: "invalid-op",
        data: { feeds: [{ id: "feed-1" }] },
      }),
    });
    assert.strictEqual(response.status, 400);
  });

  it("returns 400 when feed id is empty string", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        op: "bulk-delete",
        data: { feeds: [{ id: "" }] },
      }),
    });
    assert.strictEqual(response.status, 400);
  });

  it("bulk-delete returns 200 with deleted results for existing feed", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed to Delete",
      url: "https://example.com/delete-feed.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        op: "bulk-delete",
        data: { feeds: [{ id: feed.id }] },
      }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      results: Array<{ id: string; deleted: boolean }>;
    };
    assert.ok(body.results);
    assert.strictEqual(body.results.length, 1);
    assert.strictEqual(body.results[0]!.id, feed.id);
    assert.strictEqual(body.results[0]!.deleted, true);
  });

  it("bulk-delete returns 404 for non-existent feeds", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

    const nonExistentId = generateTestId();

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        op: "bulk-delete",
        data: { feeds: [{ id: nonExistentId }] },
      }),
    });

    assert.strictEqual(response.status, 404);
  });

  it("bulk-disable returns 200 with disabled results", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed to Disable",
      url: "https://example.com/disable-feed.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        op: "bulk-disable",
        data: { feeds: [{ id: feed.id }] },
      }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      results: Array<{ id: string; disabled: boolean }>;
    };
    assert.ok(body.results);
    assert.strictEqual(body.results.length, 1);
    assert.strictEqual(body.results[0]!.id, feed.id);
    assert.strictEqual(body.results[0]!.disabled, true);
  });

  it("bulk-enable returns 200 with enabled results", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed to Enable",
      url: "https://example.com/enable-feed.xml",
      user: { id: generateTestId(), discordUserId },
    });

    await ctx.container.userFeedRepository.disableFeedsByIds(
      [feed.id],
      UserFeedDisabledCode.Manual,
    );

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        op: "bulk-enable",
        data: { feeds: [{ id: feed.id }] },
      }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      results: Array<{ id: string; enabled: boolean }>;
    };
    assert.ok(body.results);
    assert.strictEqual(body.results.length, 1);
    assert.strictEqual(body.results[0]!.id, feed.id);
    assert.strictEqual(body.results[0]!.enabled, true);
  });

  it("bulk-delete excludes feeds owned by another user from results", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const attackerDiscordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(attackerDiscordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const ownerFeed = await ctx.container.userFeedRepository.create({
      title: "Owner's Feed",
      url: "https://example.com/owner-feed.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
    });

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        op: "bulk-delete",
        data: { feeds: [{ id: ownerFeed.id }] },
      }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      results: Array<{ id: string; deleted: boolean }>;
    };
    assert.strictEqual(body.results.length, 0);

    const feedStillExists = await ctx.container.userFeedRepository.findById(
      ownerFeed.id,
    );
    assert.ok(feedStillExists, "Feed should not be deleted");
  });

  it("bulk-disable excludes feeds owned by another user from results", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const attackerDiscordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(attackerDiscordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const ownerFeed = await ctx.container.userFeedRepository.create({
      title: "Owner's Feed",
      url: "https://example.com/owner-disable-feed.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
    });

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        op: "bulk-disable",
        data: { feeds: [{ id: ownerFeed.id }] },
      }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      results: Array<{ id: string; disabled: boolean }>;
    };
    assert.strictEqual(body.results.length, 0);

    const feedAfter = await ctx.container.userFeedRepository.findById(
      ownerFeed.id,
    );
    assert.strictEqual(
      feedAfter?.disabledCode,
      undefined,
      "Feed should not be disabled",
    );
  });

  it("bulk-enable excludes feeds owned by another user from results", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const attackerDiscordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(attackerDiscordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const ownerFeed = await ctx.container.userFeedRepository.create({
      title: "Owner's Feed",
      url: "https://example.com/owner-enable-feed.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
    });

    await ctx.container.userFeedRepository.disableFeedsByIds(
      [ownerFeed.id],
      UserFeedDisabledCode.Manual,
    );

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        op: "bulk-enable",
        data: { feeds: [{ id: ownerFeed.id }] },
      }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      results: Array<{ id: string; enabled: boolean }>;
    };
    assert.strictEqual(body.results.length, 0);

    const feedAfter = await ctx.container.userFeedRepository.findById(
      ownerFeed.id,
    );
    assert.strictEqual(
      feedAfter?.disabledCode,
      UserFeedDisabledCode.Manual,
      "Feed should still be disabled",
    );
  });

  it("shared manager can bulk-delete feeds they have accepted invites to", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const sharedManagerDiscordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(sharedManagerDiscordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const sharedFeed = await ctx.container.userFeedRepository.create({
      title: "Shared Feed",
      url: "https://example.com/shared-feed.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      shareManageOptions: {
        invites: [
          {
            discordUserId: sharedManagerDiscordUserId,
            status: UserFeedManagerStatus.Accepted,
          },
        ],
      },
    });

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        op: "bulk-delete",
        data: { feeds: [{ id: sharedFeed.id }] },
      }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      results: Array<{ id: string; deleted: boolean }>;
    };
    assert.strictEqual(body.results[0]!.id, sharedFeed.id);
    assert.strictEqual(body.results[0]!.deleted, true);
  });

  it("user with pending invite cannot bulk-delete feeds", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const pendingInviteeDiscordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(pendingInviteeDiscordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const sharedFeed = await ctx.container.userFeedRepository.create({
      title: "Shared Feed",
      url: "https://example.com/pending-invite-feed.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      shareManageOptions: {
        invites: [
          {
            discordUserId: pendingInviteeDiscordUserId,
            status: UserFeedManagerStatus.Pending,
          },
        ],
      },
    });

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        op: "bulk-delete",
        data: { feeds: [{ id: sharedFeed.id }] },
      }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      results: Array<{ id: string; deleted: boolean }>;
    };
    assert.strictEqual(body.results.length, 0);

    const feedStillExists = await ctx.container.userFeedRepository.findById(
      sharedFeed.id,
    );
    assert.ok(feedStillExists, "Feed should not be deleted");
  });

  it("returns 404 for invalid ObjectIds", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const invalidId = "not-a-valid-objectid";

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        op: "bulk-delete",
        data: { feeds: [{ id: invalidId }] },
      }),
    });

    assert.strictEqual(response.status, 404);
  });

  it("mixed authorization: returns results only for authorized feeds", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const otherOwnerDiscordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(ownerDiscordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const ownedFeed = await ctx.container.userFeedRepository.create({
      title: "My Own Feed",
      url: "https://example.com/my-own-feed.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
    });

    const sharedFeed = await ctx.container.userFeedRepository.create({
      title: "Shared With Me",
      url: "https://example.com/shared-with-me.xml",
      user: { id: generateTestId(), discordUserId: otherOwnerDiscordUserId },
      shareManageOptions: {
        invites: [
          {
            discordUserId: ownerDiscordUserId,
            status: UserFeedManagerStatus.Accepted,
          },
        ],
      },
    });

    const unauthorizedFeed = await ctx.container.userFeedRepository.create({
      title: "Not My Feed",
      url: "https://example.com/not-my-feed.xml",
      user: { id: generateTestId(), discordUserId: otherOwnerDiscordUserId },
    });

    const response = await ctx.fetch("/api/v1/user-feeds", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        op: "bulk-delete",
        data: {
          feeds: [
            { id: ownedFeed.id },
            { id: sharedFeed.id },
            { id: unauthorizedFeed.id },
          ],
        },
      }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      results: Array<{ id: string; deleted: boolean }>;
    };

    assert.strictEqual(body.results.length, 2);

    const ownedResult = body.results.find((r) => r.id === ownedFeed.id);
    const sharedResult = body.results.find((r) => r.id === sharedFeed.id);
    const unauthorizedResult = body.results.find(
      (r) => r.id === unauthorizedFeed.id,
    );

    assert.strictEqual(ownedResult?.deleted, true, "Owned feed should delete");
    assert.strictEqual(
      sharedResult?.deleted,
      true,
      "Shared feed should delete",
    );
    assert.strictEqual(
      unauthorizedResult,
      undefined,
      "Unauthorized feed should not be in results",
    );

    const unauthorizedFeedStillExists =
      await ctx.container.userFeedRepository.findById(unauthorizedFeed.id);
    assert.ok(unauthorizedFeedStillExists, "Unauthorized feed should exist");
  });
});

describe("DELETE /api/v1/user-feeds/:feedId", { concurrency: true }, () => {
  it("returns 401 without authentication", async () => {
    const feedId = generateTestId();
    const response = await ctx.fetch(`/api/v1/user-feeds/${feedId}`, {
      method: "DELETE",
    });
    assert.strictEqual(response.status, 401);
  });

  it("returns 404 for invalid ObjectId", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch("/api/v1/user-feeds/not-valid-id", {
      method: "DELETE",
      headers: { cookie: cookies },
    });
    assert.strictEqual(response.status, 404);
  });

  it("returns 404 for non-existent valid ObjectId", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);
    const nonExistentId = generateTestId();

    const response = await ctx.fetch(`/api/v1/user-feeds/${nonExistentId}`, {
      method: "DELETE",
      headers: { cookie: cookies },
    });
    assert.strictEqual(response.status, 404);
  });

  it("returns 404 when feed belongs to another user (non-manager)", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const otherDiscordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(otherDiscordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Owner's Feed",
      url: "https://example.com/delete-owner-feed.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "DELETE",
      headers: { cookie: cookies },
    });
    assert.strictEqual(response.status, 404);
  });

  it("returns 403 when user is an accepted shared manager (not creator)", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const sharedManagerDiscordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(sharedManagerDiscordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Shared Feed",
      url: "https://example.com/delete-shared-feed.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      shareManageOptions: {
        invites: [
          {
            discordUserId: sharedManagerDiscordUserId,
            status: UserFeedManagerStatus.Accepted,
          },
        ],
      },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "DELETE",
      headers: { cookie: cookies },
    });
    assert.strictEqual(response.status, 403);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "MISSING_SHARED_MANAGER_PERMISSIONS");
  });

  it("returns 204 when user is the creator", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed to Delete",
      url: "https://example.com/delete-my-feed.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "DELETE",
      headers: { cookie: cookies },
    });
    assert.strictEqual(response.status, 204);
  });

  it("actually deletes the feed from the database", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed to Verify Deletion",
      url: "https://example.com/delete-verify-feed.xml",
      user: { id: generateTestId(), discordUserId },
    });

    await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "DELETE",
      headers: { cookie: cookies },
    });

    const deleted = await ctx.container.userFeedRepository.findById(feed.id);
    assert.strictEqual(deleted, null);
  });
});

describe("GET /api/v1/user-feeds/:feedId", { concurrency: true }, () => {
  it("returns 401 without authentication", async () => {
    const feedId = generateTestId();
    const response = await ctx.fetch(`/api/v1/user-feeds/${feedId}`, {
      method: "GET",
    });
    assert.strictEqual(response.status, 401);
  });

  it("returns 404 for invalid ObjectId", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch("/api/v1/user-feeds/not-valid-id", {
      method: "GET",
      headers: { cookie: cookies },
    });
    assert.strictEqual(response.status, 404);
  });

  it("returns 404 for non-existent valid ObjectId", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);
    const nonExistentId = generateTestId();

    const response = await ctx.fetch(`/api/v1/user-feeds/${nonExistentId}`, {
      method: "GET",
      headers: { cookie: cookies },
    });
    assert.strictEqual(response.status, 404);
  });

  it("returns 404 when feed belongs to another user", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const otherDiscordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(otherDiscordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Owner's Feed",
      url: "https://example.com/owner-feed.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "GET",
      headers: { cookie: cookies },
    });
    assert.strictEqual(response.status, 404);
  });

  it("returns 200 with formatted feed data when user is the owner", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "My Feed",
      url: "https://example.com/my-feed.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "GET",
      headers: { cookie: cookies },
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: {
        id: string;
        title: string;
        url: string;
        connections: unknown[];
        createdAt: string;
        updatedAt: string;
        healthStatus: string;
        refreshRateSeconds: number;
        refreshRateOptions: unknown[];
      };
    };
    assert.ok(body.result);
    assert.strictEqual(body.result.id, feed.id);
    assert.strictEqual(body.result.title, "My Feed");
    assert.strictEqual(body.result.url, "https://example.com/my-feed.xml");
    assert.ok(Array.isArray(body.result.connections));
    assert.ok(body.result.createdAt);
    assert.ok(body.result.updatedAt);
    assert.ok(body.result.healthStatus);
    assert.ok(body.result.refreshRateSeconds !== undefined);
    assert.ok(Array.isArray(body.result.refreshRateOptions));
  });

  it("returns 200 with sharedAccessDetails.inviteId when user is an accepted shared manager", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const sharedManagerDiscordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(sharedManagerDiscordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Shared Feed",
      url: "https://example.com/shared-feed.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      shareManageOptions: {
        invites: [
          {
            discordUserId: sharedManagerDiscordUserId,
            status: UserFeedManagerStatus.Accepted,
          },
        ],
      },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "GET",
      headers: { cookie: cookies },
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: {
        sharedAccessDetails?: { inviteId: string };
      };
    };
    assert.ok(body.result.sharedAccessDetails);
    assert.ok(body.result.sharedAccessDetails.inviteId);
  });

  it("returns 404 when user has a pending (not accepted) invite", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const pendingDiscordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(pendingDiscordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Shared Feed",
      url: "https://example.com/pending-invite-get-feed.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      shareManageOptions: {
        invites: [
          {
            discordUserId: pendingDiscordUserId,
            status: UserFeedManagerStatus.Pending,
          },
        ],
      },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "GET",
      headers: { cookie: cookies },
    });
    assert.strictEqual(response.status, 404);
  });

  it("filters connections for shared manager with limited connection IDs", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const sharedManagerDiscordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(sharedManagerDiscordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed With Connections",
      url: "https://example.com/connections-feed.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      connections: {
        discordChannels: [
          {
            id: generateTestId(),
            name: "Connection 1",
            createdAt: new Date(),
            updatedAt: new Date(),
            details: { embeds: [], formatter: {} },
          } as never,
          {
            id: generateTestId(),
            name: "Connection 2",
            createdAt: new Date(),
            updatedAt: new Date(),
            details: { embeds: [], formatter: {} },
          } as never,
        ],
      },
    });

    const createdFeed = await ctx.container.userFeedRepository.findById(
      feed.id,
    );
    const firstConnectionId = createdFeed!.connections.discordChannels[0]!.id;

    await ctx.container.userFeedRepository.findOneAndUpdate(
      { _id: feed.id },
      {
        $set: {
          shareManageOptions: {
            invites: [
              {
                discordUserId: sharedManagerDiscordUserId,
                status: UserFeedManagerStatus.Accepted,
                connections: [{ connectionId: firstConnectionId }],
              },
            ],
          },
        },
      },
    );

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "GET",
      headers: { cookie: cookies },
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { connections: Array<{ id: string; name: string }> };
    };
    assert.strictEqual(body.result.connections.length, 1);
    assert.strictEqual(body.result.connections[0]!.id, firstConnectionId);
  });

  it("shared manager without connection restrictions sees all connections", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const sharedManagerDiscordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(sharedManagerDiscordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed All Connections",
      url: "https://example.com/all-connections-feed.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      connections: {
        discordChannels: [
          {
            id: generateTestId(),
            name: "Connection 1",
            createdAt: new Date(),
            updatedAt: new Date(),
            details: { embeds: [], formatter: {} },
          } as never,
          {
            id: generateTestId(),
            name: "Connection 2",
            createdAt: new Date(),
            updatedAt: new Date(),
            details: { embeds: [], formatter: {} },
          } as never,
        ],
      },
    });

    await ctx.container.userFeedRepository.findOneAndUpdate(
      { _id: feed.id },
      {
        $set: {
          shareManageOptions: {
            invites: [
              {
                discordUserId: sharedManagerDiscordUserId,
                status: UserFeedManagerStatus.Accepted,
              },
            ],
          },
        },
      },
    );

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "GET",
      headers: { cookie: cookies },
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { connections: Array<{ id: string }> };
    };
    assert.strictEqual(body.result.connections.length, 2);
  });

  it("does not include shareManageOptions for shared managers", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const sharedManagerDiscordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(sharedManagerDiscordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Shared Feed Options",
      url: "https://example.com/share-options-feed.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      shareManageOptions: {
        invites: [
          {
            discordUserId: sharedManagerDiscordUserId,
            status: UserFeedManagerStatus.Accepted,
          },
        ],
      },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "GET",
      headers: { cookie: cookies },
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { shareManageOptions?: unknown };
    };
    assert.strictEqual(body.result.shareManageOptions, undefined);
  });

  it("includes shareManageOptions for owner", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const otherDiscordUserId = generateSnowflake();

    const feed = await ctx.container.userFeedRepository.create({
      title: "Owner Share Options",
      url: "https://example.com/owner-share-options.xml",
      user: { id: generateTestId(), discordUserId },
      shareManageOptions: {
        invites: [
          {
            discordUserId: otherDiscordUserId,
            status: UserFeedManagerStatus.Accepted,
          },
        ],
      },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "GET",
      headers: { cookie: cookies },
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: {
        shareManageOptions?: { invites: unknown[] };
      };
    };
    assert.ok(body.result.shareManageOptions);
    assert.ok(Array.isArray(body.result.shareManageOptions.invites));
  });
});

describe("PATCH /api/v1/user-feeds/:feedId", { concurrency: true }, () => {
  it("returns 401 without authentication", async () => {
    const feedId = generateTestId();
    const response = await ctx.fetch(`/api/v1/user-feeds/${feedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Title" }),
    });
    assert.strictEqual(response.status, 401);
  });

  it("returns 404 for invalid ObjectId", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch("/api/v1/user-feeds/not-valid-id", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ title: "New Title" }),
    });
    assert.strictEqual(response.status, 404);
  });

  it("returns 404 for non-existent valid ObjectId", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);
    const nonExistentId = generateTestId();

    const response = await ctx.fetch(`/api/v1/user-feeds/${nonExistentId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ title: "New Title" }),
    });
    assert.strictEqual(response.status, 404);
  });

  it("returns 404 when feed belongs to another user", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const otherDiscordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(otherDiscordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Owner's Feed",
      url: "https://example.com/patch-owner-feed.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ title: "Hacked Title" }),
    });
    assert.strictEqual(response.status, 404);
  });

  it("returns 200 and updates title", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Original Title",
      url: "https://example.com/patch-title-feed.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ title: "Updated Title" }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { id: string; title: string };
    };
    assert.strictEqual(body.result.id, feed.id);
    assert.strictEqual(body.result.title, "Updated Title");
  });

  it("returns 200 and updates disabledCode to MANUAL", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed to Disable",
      url: "https://example.com/patch-disable-feed.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ disabledCode: "MANUAL" }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { disabledCode?: string };
    };
    assert.strictEqual(body.result.disabledCode, "MANUAL");
  });

  it("returns 200 and enables feed (disabledCode null)", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const created = await ctx.container.userFeedRepository.create({
      title: "Disabled Feed",
      url: "https://example.com/patch-enable-feed.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const feed = (await ctx.container.userFeedRepository.findOneAndUpdate(
      { _id: created.id },
      { $set: { disabledCode: UserFeedDisabledCode.Manual } },
    ))!;

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ disabledCode: null }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { disabledCode?: string };
    };
    assert.strictEqual(body.result.disabledCode, undefined);
  });

  it("shared manager can update feed", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const sharedManagerDiscordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(sharedManagerDiscordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Shared Feed to Update",
      url: "https://example.com/patch-shared-feed.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      shareManageOptions: {
        invites: [
          {
            discordUserId: sharedManagerDiscordUserId,
            status: UserFeedManagerStatus.Accepted,
          },
        ],
      },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ title: "Updated by Shared Manager" }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { title: string };
    };
    assert.strictEqual(body.result.title, "Updated by Shared Manager");
  });

  it("pending invite cannot update feed", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const pendingDiscordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(pendingDiscordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Pending Invite Feed",
      url: "https://example.com/patch-pending-invite-feed.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      shareManageOptions: {
        invites: [
          {
            discordUserId: pendingDiscordUserId,
            status: UserFeedManagerStatus.Pending,
          },
        ],
      },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ title: "Should Not Work" }),
    });
    assert.strictEqual(response.status, 404);
  });

  it("returns 400 when title is empty string", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Empty Title",
      url: "https://example.com/patch-empty-title-feed.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ title: "" }),
    });
    assert.strictEqual(response.status, 400);
  });

  it("returns 400 for invalid timezone", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Invalid TZ",
      url: "https://example.com/patch-invalid-tz.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        formatOptions: { dateTimezone: "INVALID_TZ" },
      }),
    });
    assert.strictEqual(response.status, 400);
  });

  it("returns 200 for valid timezone", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Valid TZ",
      url: "https://example.com/patch-valid-tz.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        formatOptions: { dateTimezone: "America/New_York" },
      }),
    });
    assert.strictEqual(response.status, 200);
  });

  it("returns 200 for empty timezone (skips validation)", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Empty TZ",
      url: "https://example.com/patch-empty-tz.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        formatOptions: { dateTimezone: "" },
      }),
    });
    assert.strictEqual(response.status, 200);
  });

  it("returns 400 for invalid locale", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Invalid Locale",
      url: "https://example.com/patch-invalid-locale.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        formatOptions: { dateLocale: "zz-invalid" },
      }),
    });
    assert.strictEqual(response.status, 400);
  });

  it("returns 200 for valid locale", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Valid Locale",
      url: "https://example.com/patch-valid-locale.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        formatOptions: { dateLocale: "en" },
      }),
    });
    assert.strictEqual(response.status, 200);
  });

  it("returns 400 for duplicate externalProperties labels", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Dupe Labels",
      url: "https://example.com/patch-dupe-labels.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        externalProperties: [
          {
            id: "1",
            sourceField: "field1",
            label: "same-label",
            cssSelector: ".a",
          },
          {
            id: "2",
            sourceField: "field2",
            label: "same-label",
            cssSelector: ".b",
          },
        ],
      }),
    });
    assert.strictEqual(response.status, 400);
  });

  it("returns 200 for unique externalProperties labels", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Unique Labels",
      url: "https://example.com/patch-unique-labels.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        externalProperties: [
          {
            id: "1",
            sourceField: "field1",
            label: "label-a",
            cssSelector: ".a",
          },
          {
            id: "2",
            sourceField: "field2",
            label: "label-b",
            cssSelector: ".b",
          },
        ],
      }),
    });
    assert.strictEqual(response.status, 200);
  });

  it("strips extraneous fields and still succeeds", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Extra Fields",
      url: "https://example.com/patch-extra-fields-feed.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ title: "Valid", unknownField: "bad" }),
    });
    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { title: string };
    };
    assert.strictEqual(body.result.title, "Valid");
  });

  describe("url update", () => {
    const patchUrlResponses: Record<string, string> = {
      "https://example.com/patch-url-valid.xml": "SUCCESS",
      "https://example.com/patch-url-timeout.xml": "TIMED_OUT",
      "https://example.com/patch-url-parse.xml": "PARSE_ERROR",
      "https://example.com/patch-url-fetch.xml": "FETCH_ERROR",
      "https://example.com/patch-url-ssl.xml": "INVALID_SSL_CERTIFICATE",
    };

    beforeEach(() => {
      feedApiMockServer.registerRoute(
        "POST",
        "/v1/user-feeds/get-articles",
        (req) => {
          const reqUrl = (req.body as { url?: string })?.url ?? "";
          const requestStatus = patchUrlResponses[reqUrl] || "SUCCESS";

          return {
            status: 200,
            body: {
              result: {
                requestStatus,
                articles: [],
                totalArticles: 0,
                selectedProperties: [],
                url: reqUrl,
                feedTitle: "Feed",
              },
            },
          };
        },
      );
    });

    it("returns 200 and updates url when valid", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const newUrl = "https://example.com/patch-url-valid.xml";

      const feed = await ctx.container.userFeedRepository.create({
        title: "Feed for URL Update",
        url: "https://example.com/patch-url-old.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: cookies,
        },
        body: JSON.stringify({ url: newUrl }),
      });
      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as { result: { url: string } };
      assert.strictEqual(body.result.url, newUrl);
    });

    it("returns 400 FEED_REQUEST_TIMEOUT on url timeout", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const newUrl = "https://example.com/patch-url-timeout.xml";

      const feed = await ctx.container.userFeedRepository.create({
        title: "Feed for URL Timeout",
        url: "https://example.com/patch-url-timeout-old.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: cookies,
        },
        body: JSON.stringify({ url: newUrl }),
      });
      assert.strictEqual(response.status, 400);
      const body = (await response.json()) as { code: string };
      assert.strictEqual(body.code, "FEED_REQUEST_TIMEOUT");
    });

    it("returns 400 ADD_FEED_PARSE_FAILED on url parse error", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const newUrl = "https://example.com/patch-url-parse.xml";

      const feed = await ctx.container.userFeedRepository.create({
        title: "Feed for URL Parse Error",
        url: "https://example.com/patch-url-parse-old.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: cookies,
        },
        body: JSON.stringify({ url: newUrl }),
      });
      assert.strictEqual(response.status, 400);
      const body = (await response.json()) as { code: string };
      assert.strictEqual(body.code, "ADD_FEED_PARSE_FAILED");
    });

    it("returns 400 FEED_FETCH_FAILED on url fetch error", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const newUrl = "https://example.com/patch-url-fetch.xml";

      const feed = await ctx.container.userFeedRepository.create({
        title: "Feed for URL Fetch Error",
        url: "https://example.com/patch-url-fetch-old.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: cookies,
        },
        body: JSON.stringify({ url: newUrl }),
      });
      assert.strictEqual(response.status, 400);
      const body = (await response.json()) as { code: string };
      assert.strictEqual(body.code, "FEED_FETCH_FAILED");
    });

    it("returns 400 FEED_INVALID_SSL_CERT on invalid ssl", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const newUrl = "https://example.com/patch-url-ssl.xml";

      const feed = await ctx.container.userFeedRepository.create({
        title: "Feed for URL SSL Error",
        url: "https://example.com/patch-url-ssl-old.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: cookies,
        },
        body: JSON.stringify({ url: newUrl }),
      });
      assert.strictEqual(response.status, 400);
      const body = (await response.json()) as { code: string };
      assert.strictEqual(body.code, "FEED_INVALID_SSL_CERT");
    });
  });

  it("returns 200 and sets userRefreshRateSeconds", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Refresh Rate",
      url: "https://example.com/patch-refresh-rate.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ userRefreshRateSeconds: 3600 }),
    });
    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { userRefreshRateSeconds: number };
    };
    assert.strictEqual(body.result.userRefreshRateSeconds, 3600);
  });

  it("returns 400 when userRefreshRateSeconds is too high", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for High Refresh",
      url: "https://example.com/patch-refresh-high.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ userRefreshRateSeconds: 86401 }),
    });
    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "USER_REFRESH_RATE_NOT_ALLOWED");
  });

  it("returns 400 when userRefreshRateSeconds is too low", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Low Refresh",
      url: "https://example.com/patch-refresh-low.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ userRefreshRateSeconds: 60 }),
    });
    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "USER_REFRESH_RATE_NOT_ALLOWED");
  });

  it("returns 400 FEED_LIMIT_REACHED when enabling at limit", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const maxFeeds = ctx.container.config.BACKEND_API_DEFAULT_MAX_USER_FEEDS;

    for (let i = 0; i < maxFeeds; i++) {
      await ctx.container.userFeedRepository.create({
        title: `Enabled Feed ${i}`,
        url: `https://example.com/patch-limit-enabled-${i}.xml`,
        user: { id: generateTestId(), discordUserId },
      });
    }

    const disabledFeed = await ctx.container.userFeedRepository.create({
      title: "Disabled Feed at Limit",
      url: "https://example.com/patch-limit-disabled.xml",
      user: { id: generateTestId(), discordUserId },
    });

    await ctx.container.userFeedRepository.updateById(disabledFeed.id, {
      $set: { disabledCode: UserFeedDisabledCode.ExceededFeedLimit },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${disabledFeed.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ disabledCode: null }),
    });
    assert.strictEqual(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "FEED_LIMIT_REACHED");
  });

  it("returns 200 and updates passingComparisons", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Passing Comparisons",
      url: "https://example.com/patch-passing-comp.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ passingComparisons: ["title"] }),
    });
    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { passingComparisons: string[] };
    };
    assert.deepStrictEqual(body.result.passingComparisons, ["title"]);
  });

  it("returns 200 and updates blockingComparisons", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Blocking Comparisons",
      url: "https://example.com/patch-blocking-comp.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ blockingComparisons: ["guid"] }),
    });
    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { blockingComparisons: string[] };
    };
    assert.deepStrictEqual(body.result.blockingComparisons, ["guid"]);
  });

  it("returns 200 and updates dateCheckOptions", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Date Check Options",
      url: "https://example.com/patch-date-check.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        dateCheckOptions: { oldArticleDateDiffMsThreshold: 86400000 },
      }),
    });
    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: {
        dateCheckOptions: { oldArticleDateDiffMsThreshold: number };
      };
    };
    assert.strictEqual(
      body.result.dateCheckOptions.oldArticleDateDiffMsThreshold,
      86400000,
    );
  });

  it("returns 400 for negative dateCheckOptions threshold", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Negative Date Check",
      url: "https://example.com/patch-date-check-neg.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        dateCheckOptions: { oldArticleDateDiffMsThreshold: -1 },
      }),
    });
    assert.strictEqual(response.status, 400);
  });

  it("returns 200 and updates shareManageOptions", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Share Options",
      url: "https://example.com/patch-share-opts.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        shareManageOptions: {
          invites: [{ discordUserId: "123456789" }],
        },
      }),
    });
    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: {
        shareManageOptions: {
          invites: Array<{ discordUserId: string }>;
        };
      };
    };
    assert.strictEqual(
      body.result.shareManageOptions.invites[0]!.discordUserId,
      "123456789",
    );
  });

  it("returns 200 for empty dateLocale", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Empty Locale",
      url: "https://example.com/patch-empty-locale.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({
        formatOptions: { dateLocale: "" },
      }),
    });
    assert.strictEqual(response.status, 200);
  });

  it("filters connections for shared manager with limited connection IDs", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const sharedManagerDiscordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(sharedManagerDiscordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Patch Connections Filter",
      url: "https://example.com/patch-conn-filter.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      connections: {
        discordChannels: [
          {
            id: generateTestId(),
            name: "Connection 1",
            createdAt: new Date(),
            updatedAt: new Date(),
            details: { embeds: [], formatter: {} },
          } as never,
          {
            id: generateTestId(),
            name: "Connection 2",
            createdAt: new Date(),
            updatedAt: new Date(),
            details: { embeds: [], formatter: {} },
          } as never,
        ],
      },
    });

    const createdFeed = await ctx.container.userFeedRepository.findById(
      feed.id,
    );
    const firstConnectionId = createdFeed!.connections.discordChannels[0]!.id;

    await ctx.container.userFeedRepository.findOneAndUpdate(
      { _id: feed.id },
      {
        $set: {
          shareManageOptions: {
            invites: [
              {
                discordUserId: sharedManagerDiscordUserId,
                status: UserFeedManagerStatus.Accepted,
                connections: [{ connectionId: firstConnectionId }],
              },
            ],
          },
        },
      },
    );

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ title: "Updated by Limited Manager" }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { connections: Array<{ id: string }> };
    };
    assert.strictEqual(body.result.connections.length, 1);
    assert.strictEqual(body.result.connections[0]!.id, firstConnectionId);
  });

  it("unsets userRefreshRateSeconds when null is sent", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Null Refresh Rate",
      url: "https://example.com/patch-null-refresh.xml",
      user: { id: generateTestId(), discordUserId },
    });

    await ctx.container.userFeedRepository.findOneAndUpdate(
      { _id: feed.id },
      { $set: { userRefreshRateSeconds: 3600 } },
    );

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ userRefreshRateSeconds: null }),
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: { userRefreshRateSeconds?: number };
    };
    assert.strictEqual(body.result.userRefreshRateSeconds, undefined);
  });
});

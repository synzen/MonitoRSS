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
  UserFeedHealthStatus,
  UserFeedManagerStatus,
} from "../../src/repositories/shared/enums";
import { GetFeedArticlesFilterReturnType } from "../../src/services/feed-handler/types";

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

describe("POST /api/v1/user-feeds/:feedId/clone", { concurrency: true }, () => {
  const cloneUrlResponses: Record<string, string> = {
    "https://example.com/clone-url-timeout.xml": "TIMED_OUT",
    "https://example.com/clone-url-parse.xml": "PARSE_ERROR",
    "https://example.com/clone-url-fetch.xml": "FETCH_ERROR",
  };

  beforeEach(() => {
    feedApiMockServer.registerRoute(
      "POST",
      "/v1/user-feeds/get-articles",
      (req) => {
        const reqUrl = (req.body as { url?: string })?.url ?? "";
        const requestStatus = cloneUrlResponses[reqUrl] || "SUCCESS";

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

  it("returns 401 without authentication", async () => {
    const feedId = generateTestId();
    const response = await ctx.fetch(`/api/v1/user-feeds/${feedId}/clone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.strictEqual(response.status, 401);
  });

  it("returns 404 for non-existent feed ID", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());
    const cookies = await ctx.setSession(mockAccessToken);
    const nonExistentId = generateTestId();

    const response = await ctx.fetch(
      `/api/v1/user-feeds/${nonExistentId}/clone`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: cookies,
        },
        body: JSON.stringify({}),
      },
    );
    assert.strictEqual(response.status, 404);
  });

  it("returns 201 and creates a cloned feed with same URL", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Original Feed",
      url: "https://example.com/clone-source.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}/clone`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({}),
    });

    assert.strictEqual(response.status, 201);
    const body = (await response.json()) as {
      result: { id: string };
    };
    assert.ok(body.result.id);
    assert.notStrictEqual(body.result.id, feed.id);

    const clonedFeed = await ctx.container.userFeedRepository.findById(
      body.result.id,
    );
    assert.ok(clonedFeed);
    assert.strictEqual(clonedFeed.url, feed.url);
    assert.strictEqual(clonedFeed.title, feed.title);
  });

  it("returns 201 and uses custom title when provided", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Original Feed Title",
      url: "https://example.com/clone-title.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}/clone`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ title: "Custom Cloned Title" }),
    });

    assert.strictEqual(response.status, 201);
    const body = (await response.json()) as {
      result: { id: string };
    };
    assert.ok(body.result.id);

    const clonedFeed = await ctx.container.userFeedRepository.findById(
      body.result.id,
    );
    assert.ok(clonedFeed);
    assert.strictEqual(clonedFeed.title, "Custom Cloned Title");
  });

  it("returns 400 with FEED_LIMIT_REACHED when user is at feed limit", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const maxFeeds = ctx.container.config.BACKEND_API_DEFAULT_MAX_USER_FEEDS;
    for (let i = 0; i < maxFeeds; i++) {
      await ctx.container.userFeedRepository.create({
        title: `Feed ${i}`,
        url: `https://example.com/clone-limit-${i}.xml`,
        user: { id: generateTestId(), discordUserId },
      });
    }

    const feedToClone = await ctx.container.userFeedRepository.create({
      title: "Feed to Clone",
      url: "https://example.com/clone-limit-source.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(
      `/api/v1/user-feeds/${feedToClone.id}/clone`,
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
    const body = (await response.json()) as { code: string };
    assert.strictEqual(body.code, "FEED_LIMIT_REACHED");
  });

  it("returns 201 when cloned by accepted shared manager", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const sharedManagerDiscordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(sharedManagerDiscordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Shared Feed to Clone",
      url: "https://example.com/clone-shared.xml",
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

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}/clone`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({}),
    });

    assert.strictEqual(response.status, 201);
    const body = (await response.json()) as { result: { id: string } };
    assert.ok(body.result.id);
    assert.notStrictEqual(body.result.id, feed.id);
  });

  it("clones feed with discord channel connections", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const connectionName = "Clone Connection";
    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed With Connection",
      url: "https://example.com/clone-connections.xml",
      user: { id: generateTestId(), discordUserId },
      connections: {
        discordChannels: [
          {
            id: generateTestId(),
            name: connectionName,
            createdAt: new Date(),
            updatedAt: new Date(),
            details: { embeds: [], formatter: {} },
          } as never,
        ],
      },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}/clone`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({}),
    });

    assert.strictEqual(response.status, 201);
    const body = (await response.json()) as { result: { id: string } };

    const clonedFeed = await ctx.container.userFeedRepository.findById(
      body.result.id,
    );
    assert.ok(clonedFeed);
    assert.ok(clonedFeed.connections.discordChannels.length > 0);
    assert.strictEqual(
      clonedFeed.connections.discordChannels[0]!.name,
      connectionName,
    );
    assert.notStrictEqual(
      clonedFeed.connections.discordChannels[0]!.id,
      feed.connections.discordChannels[0]!.id,
    );
  });

  it("returns 404 when cloning feed owned by another user", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const otherDiscordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(otherDiscordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Someone Else's Feed",
      url: "https://example.com/clone-not-owned.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}/clone`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({}),
    });

    assert.strictEqual(response.status, 404);
  });

  it("strips extraneous body fields and still succeeds", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Extra Fields",
      url: "https://example.com/clone-extra-fields.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}/clone`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ title: "Clone", unknownField: "bad" }),
    });

    assert.strictEqual(response.status, 201);
    const body = (await response.json()) as { result: { id: string } };
    assert.ok(body.result.id);
  });

  it("returns 201 and uses new URL when url is provided", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);
    const newUrl = "https://example.com/clone-new-url.xml";

    const feed = await ctx.container.userFeedRepository.create({
      title: "Original Feed",
      url: "https://example.com/clone-original-url.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}/clone`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({ url: newUrl }),
    });

    assert.strictEqual(response.status, 201);
    const body = (await response.json()) as { result: { id: string } };
    assert.ok(body.result.id);

    const clonedFeed = await ctx.container.userFeedRepository.findById(
      body.result.id,
    );
    assert.ok(clonedFeed);
    assert.strictEqual(clonedFeed.url, newUrl);
  });

  it("returns 400 FEED_REQUEST_TIMEOUT when cloning with invalid url", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);
    const newUrl = "https://example.com/clone-url-timeout.xml";

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Clone Timeout",
      url: "https://example.com/clone-url-timeout-old.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}/clone`, {
      method: "POST",
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

  it("returns 400 ADD_FEED_PARSE_FAILED when cloning with unparseable url", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);
    const newUrl = "https://example.com/clone-url-parse.xml";

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Clone Parse Error",
      url: "https://example.com/clone-url-parse-old.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}/clone`, {
      method: "POST",
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

  it("returns 400 FEED_FETCH_FAILED when cloning with unreachable url", async () => {
    const discordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(discordUserId);
    const cookies = await ctx.setSession(mockAccessToken);
    const newUrl = "https://example.com/clone-url-fetch.xml";

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed for Clone Fetch Error",
      url: "https://example.com/clone-url-fetch-old.xml",
      user: { id: generateTestId(), discordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}/clone`, {
      method: "POST",
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

  it("returns 201 when admin clones another user's feed", async () => {
    const ownerDiscordUserId = generateSnowflake();
    const adminDiscordUserId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(adminDiscordUserId);
    const cookies = await ctx.setSession(mockAccessToken);

    const adminUser =
      await ctx.container.usersService.getOrCreateUserByDiscordId(
        adminDiscordUserId,
      );
    ctx.container.config.BACKEND_API_ADMIN_USER_IDS.push(adminUser.id);

    const feed = await ctx.container.userFeedRepository.create({
      title: "Feed Owned by Another User",
      url: "https://example.com/clone-admin.xml",
      user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
    });

    const response = await ctx.fetch(`/api/v1/user-feeds/${feed.id}/clone`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookies,
      },
      body: JSON.stringify({}),
    });

    assert.strictEqual(response.status, 201);
    const body = (await response.json()) as { result: { id: string } };
    assert.ok(body.result.id);

    ctx.container.config.BACKEND_API_ADMIN_USER_IDS.pop();
  });
});

describe(
  "POST /api/v1/user-feeds/:feedId/test-send",
  { concurrency: true },
  () => {
    it("returns 401 without authentication", async () => {
      const feedId = generateTestId();
      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feedId}/test-send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            article: { id: "article-1" },
            channelId: "123",
          }),
        },
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 404 for non-existent feed", async () => {
      const mockAccessToken = createMockAccessToken(generateSnowflake());
      const cookies = await ctx.setSession(mockAccessToken);
      const nonExistentId = generateTestId();

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${nonExistentId}/test-send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            article: { id: "article-1" },
            channelId: "123",
          }),
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 400 when article is missing", async () => {
      const mockAccessToken = createMockAccessToken(generateSnowflake());
      const cookies = await ctx.setSession(mockAccessToken);
      const feedId = generateTestId();

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feedId}/test-send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({ channelId: "123" }),
        },
      );
      assert.strictEqual(response.status, 400);
    });

    it("returns 400 when channelId is missing", async () => {
      const mockAccessToken = createMockAccessToken(generateSnowflake());
      const cookies = await ctx.setSession(mockAccessToken);
      const feedId = generateTestId();

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feedId}/test-send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({ article: { id: "article-1" } }),
        },
      );
      assert.strictEqual(response.status, 400);
    });

    it("returns 200 on successful test send", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const channelId = generateSnowflake();
      const guildId = generateSnowflake();

      const feed = await ctx.container.userFeedRepository.create({
        title: "Test Send Feed",
        url: "https://example.com/test-send-feed.xml",
        user: { id: generateTestId(), discordUserId },
      });

      ctx.discordMockServer.registerRoute("GET", `/channels/${channelId}`, {
        status: 200,
        body: {
          id: channelId,
          guild_id: guildId,
          type: 0,
        },
      });

      ctx.discordMockServer.registerRouteForToken(
        "GET",
        "/users/@me/guilds",
        mockAccessToken.access_token,
        {
          status: 200,
          body: [
            {
              id: guildId,
              name: "Test Server",
              owner: false,
              permissions: "16",
            },
          ],
        },
      );

      feedApiMockServer.registerRoute("POST", "/v1/user-feeds/test", {
        status: 200,
        body: {
          status: "SUCCESS",
        },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/test-send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            article: { id: "article-1" },
            channelId,
          }),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { status: string };
      };
      assert.ok(body.result);
      assert.strictEqual(body.result.status, "SUCCESS");
    });

    it("returns 400 with FEED_MISSING_CHANNEL when channel not found", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const channelId = generateSnowflake();

      const feed = await ctx.container.userFeedRepository.create({
        title: "Test Send Channel Not Found",
        url: "https://example.com/test-send-no-channel.xml",
        user: { id: generateTestId(), discordUserId },
      });

      ctx.discordMockServer.registerRoute("GET", `/channels/${channelId}`, {
        status: 404,
        body: { message: "Unknown Channel", code: 10003 },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/test-send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            article: { id: "article-1" },
            channelId,
          }),
        },
      );

      assert.strictEqual(response.status, 400);
      const body = (await response.json()) as { code: string };
      assert.strictEqual(body.code, "FEED_MISSING_CHANNEL");
    });

    it("returns 400 for invalid timezone", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Test Send Invalid TZ",
        url: "https://example.com/test-send-invalid-tz.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/test-send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            article: { id: "article-1" },
            channelId: "123",
            userFeedFormatOptions: { dateTimezone: "INVALID_TZ" },
          }),
        },
      );
      assert.strictEqual(response.status, 400);
    });

    it("returns 400 for invalid timezone in test-send with null userFeedFormatOptions", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedId = generateTestId();

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feedId}/test-send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            article: { id: "article-1" },
            channelId: "123",
            userFeedFormatOptions: null,
          }),
        },
      );
      assert.notStrictEqual(response.status, 500);
    });

    it("returns 403 with FEED_USER_MISSING_MANAGE_GUILD when user lacks permission", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const channelId = generateSnowflake();
      const guildId = generateSnowflake();

      const feed = await ctx.container.userFeedRepository.create({
        title: "Test Send No Permission",
        url: "https://example.com/test-send-no-perm.xml",
        user: { id: generateTestId(), discordUserId },
      });

      ctx.discordMockServer.registerRoute("GET", `/channels/${channelId}`, {
        status: 200,
        body: {
          id: channelId,
          guild_id: guildId,
          type: 0,
        },
      });

      ctx.discordMockServer.registerRouteForToken(
        "GET",
        "/users/@me/guilds",
        mockAccessToken.access_token,
        {
          status: 200,
          body: [
            {
              id: guildId,
              name: "Test Server",
              owner: false,
              permissions: "0",
            },
          ],
        },
      );

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/test-send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            article: { id: "article-1" },
            channelId,
          }),
        },
      );

      assert.strictEqual(response.status, 403);
      const body = (await response.json()) as { code: string };
      assert.strictEqual(body.code, "FEED_USER_MISSING_MANAGE_GUILD");
    });
  },
);

describe(
  "POST /api/v1/user-feeds/:feedId/date-preview",
  { concurrency: true },
  () => {
    it("returns 401 without authentication", async () => {
      const response = await ctx.fetch(
        "/api/v1/user-feeds/fake-feed-id/date-preview",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 200 with default values", async () => {
      const mockAccessToken = createMockAccessToken(generateSnowflake());
      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        "/api/v1/user-feeds/fake-feed-id/date-preview",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({}),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { valid: boolean; output: string };
      };
      assert.strictEqual(body.result.valid, true);
      assert.ok(typeof body.result.output === "string");
      assert.ok(body.result.output.length > 0);
    });

    it("returns 200 with custom date format", async () => {
      const mockAccessToken = createMockAccessToken(generateSnowflake());
      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        "/api/v1/user-feeds/fake-feed-id/date-preview",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({ dateFormat: "YYYY-MM-DD" }),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { valid: boolean; output: string };
      };
      assert.strictEqual(body.result.valid, true);
      assert.match(body.result.output, /^\d{4}-\d{2}-\d{2}$/);
    });

    it("returns 200 with custom timezone", async () => {
      const mockAccessToken = createMockAccessToken(generateSnowflake());
      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        "/api/v1/user-feeds/fake-feed-id/date-preview",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({ dateTimezone: "America/New_York" }),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { valid: boolean; output: string };
      };
      assert.strictEqual(body.result.valid, true);
    });

    it("returns 200 with custom locale", async () => {
      const mockAccessToken = createMockAccessToken(generateSnowflake());
      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        "/api/v1/user-feeds/fake-feed-id/date-preview",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({ dateLocale: "fr" }),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { valid: boolean; output: string };
      };
      assert.strictEqual(body.result.valid, true);
    });

    it("returns 200 with valid false for invalid timezone", async () => {
      const mockAccessToken = createMockAccessToken(generateSnowflake());
      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        "/api/v1/user-feeds/fake-feed-id/date-preview",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({ dateTimezone: "Invalid/Zone" }),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { valid: boolean; output?: string };
      };
      assert.strictEqual(body.result.valid, false);
    });
  },
);

describe(
  "GET /api/v1/user-feeds/:feedId/requests",
  { concurrency: true },
  () => {
    const feedRequestsMockHandler = (req: { url: string }) => {
      const url = new URL(req.url, "http://localhost");
      return {
        status: 200,
        body: {
          result: {
            requests: [],
            nextRetryTimestamp: null,
            receivedLimit: url.searchParams.get("limit"),
            receivedSkip: url.searchParams.get("skip"),
          },
        },
      };
    };

    it("returns 401 without authentication", async () => {
      const feedId = generateTestId();
      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feedId}/requests`,
        {
          method: "GET",
        },
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 404 for invalid ObjectId", async () => {
      const mockAccessToken = createMockAccessToken(generateSnowflake());
      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        "/api/v1/user-feeds/not-valid-id/requests",
        {
          method: "GET",
          headers: { cookie: cookies },
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 404 for non-existent valid ObjectId", async () => {
      const mockAccessToken = createMockAccessToken(generateSnowflake());
      const cookies = await ctx.setSession(mockAccessToken);
      const nonExistentId = generateTestId();

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${nonExistentId}/requests`,
        {
          method: "GET",
          headers: { cookie: cookies },
        },
      );
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

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/requests`,
        {
          method: "GET",
          headers: { cookie: cookies },
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 200 when user owns the feed", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "My Feed",
        url: "https://example.com/my-feed.xml",
        user: { id: generateTestId(), discordUserId },
      });

      feedApiMockServer.registerRoute(
        "GET",
        "/v1/feed-requests",
        feedRequestsMockHandler,
      );

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/requests`,
        {
          method: "GET",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
    });

    it("returns 200 when user is an accepted shared manager", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const sharedManagerDiscordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(sharedManagerDiscordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Shared Feed Requests",
        url: "https://example.com/shared-feed-requests.xml",
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

      feedApiMockServer.registerRoute(
        "GET",
        "/v1/feed-requests",
        feedRequestsMockHandler,
      );

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/requests`,
        {
          method: "GET",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
    });

    it("returns 200 when admin accesses another user's feed", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const adminDiscordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(adminDiscordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const adminUser =
        await ctx.container.usersService.getOrCreateUserByDiscordId(
          adminDiscordUserId,
        );
      ctx.container.config.BACKEND_API_ADMIN_USER_IDS.push(adminUser.id);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Admin Access Feed Requests",
        url: "https://example.com/admin-feed-requests.xml",
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      });

      feedApiMockServer.registerRoute(
        "GET",
        "/v1/feed-requests",
        feedRequestsMockHandler,
      );

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/requests`,
        {
          method: "GET",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);

      ctx.container.config.BACKEND_API_ADMIN_USER_IDS.pop();
    });

    it("returns 400 when limit is below minimum", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Feed Limit Validation",
        url: "https://example.com/limit-validation.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/requests?limit=0`,
        {
          method: "GET",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 400);
    });

    it("returns 400 when limit exceeds maximum", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Feed Limit Max Validation",
        url: "https://example.com/limit-max-validation.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/requests?limit=51`,
        {
          method: "GET",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 400);
    });

    it("returns 400 when skip is negative", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Feed Skip Validation",
        url: "https://example.com/skip-validation.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/requests?skip=-1`,
        {
          method: "GET",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 400);
    });

    it("returns 400 when limit is not a number", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Feed Limit NaN Validation",
        url: "https://example.com/limit-nan-validation.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/requests?limit=abc`,
        {
          method: "GET",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 400);
    });

    it("forwards limit and skip query params to upstream API", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Feed Query Forward",
        url: "https://example.com/query-forward.xml",
        user: { id: generateTestId(), discordUserId },
      });

      feedApiMockServer.registerRoute(
        "GET",
        "/v1/feed-requests",
        feedRequestsMockHandler,
      );

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/requests?limit=10&skip=5`,
        {
          method: "GET",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { receivedLimit: string; receivedSkip: string };
      };
      assert.strictEqual(body.result.receivedLimit, "10");
      assert.strictEqual(body.result.receivedSkip, "5");
    });
  },
);

describe(
  "GET /api/v1/user-feeds/:feedId/delivery-logs",
  { concurrency: true },
  () => {
    const deliveryLogsMockHandler = (req: { url: string }) => {
      const url = new URL(req.url, "http://localhost");
      return {
        status: 200,
        body: {
          result: {
            logs: [],
            receivedLimit: url.searchParams.get("limit"),
            receivedSkip: url.searchParams.get("skip"),
          },
        },
      };
    };

    it("returns 401 without authentication", async () => {
      const feedId = generateTestId();
      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feedId}/delivery-logs`,
        {
          method: "GET",
        },
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 404 for invalid ObjectId", async () => {
      const mockAccessToken = createMockAccessToken(generateSnowflake());
      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        "/api/v1/user-feeds/not-valid-id/delivery-logs",
        {
          method: "GET",
          headers: { cookie: cookies },
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 404 for non-existent valid ObjectId", async () => {
      const mockAccessToken = createMockAccessToken(generateSnowflake());
      const cookies = await ctx.setSession(mockAccessToken);
      const nonExistentId = generateTestId();

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${nonExistentId}/delivery-logs`,
        {
          method: "GET",
          headers: { cookie: cookies },
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 404 when feed belongs to another user", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const otherDiscordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(otherDiscordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Other User Delivery Logs Feed",
        url: "https://example.com/other-delivery-logs.xml",
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-logs`,
        {
          method: "GET",
          headers: { cookie: cookies },
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 200 when user owns the feed", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Own Feed Delivery Logs",
        url: "https://example.com/own-delivery-logs.xml",
        user: { id: generateTestId(), discordUserId },
      });

      feedApiMockServer.registerRoute(
        "GET",
        `/v1/user-feeds/${feed.id}/delivery-logs`,
        deliveryLogsMockHandler,
      );

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-logs`,
        {
          method: "GET",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
    });

    it("returns 200 when user is an accepted shared manager", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const sharedManagerDiscordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(sharedManagerDiscordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Shared Feed Delivery Logs",
        url: "https://example.com/shared-delivery-logs.xml",
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

      feedApiMockServer.registerRoute(
        "GET",
        `/v1/user-feeds/${feed.id}/delivery-logs`,
        deliveryLogsMockHandler,
      );

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-logs`,
        {
          method: "GET",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
    });

    it("returns 200 when admin accesses another user's feed", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const adminDiscordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(adminDiscordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const adminUser =
        await ctx.container.usersService.getOrCreateUserByDiscordId(
          adminDiscordUserId,
        );
      ctx.container.config.BACKEND_API_ADMIN_USER_IDS.push(adminUser.id);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Admin Access Delivery Logs Feed",
        url: "https://example.com/admin-delivery-logs.xml",
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      });

      feedApiMockServer.registerRoute(
        "GET",
        `/v1/user-feeds/${feed.id}/delivery-logs`,
        deliveryLogsMockHandler,
      );

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-logs`,
        {
          method: "GET",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);

      ctx.container.config.BACKEND_API_ADMIN_USER_IDS.pop();
    });

    it("returns 400 when limit is below minimum", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Delivery Logs Limit Validation",
        url: "https://example.com/delivery-logs-limit-validation.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-logs?limit=0`,
        {
          method: "GET",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 400);
    });

    it("returns 400 when limit exceeds maximum", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Delivery Logs Limit Max Validation",
        url: "https://example.com/delivery-logs-limit-max.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-logs?limit=51`,
        {
          method: "GET",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 400);
    });

    it("returns 400 when skip is negative", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Delivery Logs Skip Validation",
        url: "https://example.com/delivery-logs-skip-validation.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-logs?skip=-1`,
        {
          method: "GET",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 400);
    });

    it("returns 400 when skip exceeds maximum", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Delivery Logs Skip Max Validation",
        url: "https://example.com/delivery-logs-skip-max.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-logs?skip=1001`,
        {
          method: "GET",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 400);
    });

    it("returns 400 when limit is not a number", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Delivery Logs Limit NaN Validation",
        url: "https://example.com/delivery-logs-limit-nan.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-logs?limit=abc`,
        {
          method: "GET",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 400);
    });

    it("forwards limit and skip query params to upstream API", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Delivery Logs Query Forward",
        url: "https://example.com/delivery-logs-query-forward.xml",
        user: { id: generateTestId(), discordUserId },
      });

      feedApiMockServer.registerRoute(
        "GET",
        `/v1/user-feeds/${feed.id}/delivery-logs`,
        deliveryLogsMockHandler,
      );

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-logs?limit=10&skip=5`,
        {
          method: "GET",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { receivedLimit: string; receivedSkip: string };
      };
      assert.strictEqual(body.result.receivedLimit, "10");
      assert.strictEqual(body.result.receivedSkip, "5");
    });
  },
);

describe(
  "POST /api/v1/user-feeds/:feedId/delivery-preview",
  { concurrency: true },
  () => {
    const deliveryPreviewMockHandler = (req: { body?: unknown }) => {
      const reqBody = req.body as Record<string, unknown> | undefined;
      return {
        status: 200,
        body: {
          receivedSkip: reqBody?.skip,
          receivedLimit: reqBody?.limit,
        },
      };
    };

    it("returns 401 without authentication", async () => {
      const feedId = generateTestId();
      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feedId}/delivery-preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 404 for invalid ObjectId", async () => {
      const mockAccessToken = createMockAccessToken(generateSnowflake());
      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        "/api/v1/user-feeds/not-valid-id/delivery-preview",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({}),
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 404 for non-existent valid ObjectId", async () => {
      const mockAccessToken = createMockAccessToken(generateSnowflake());
      const cookies = await ctx.setSession(mockAccessToken);
      const nonExistentId = generateTestId();

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${nonExistentId}/delivery-preview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({}),
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 404 when feed belongs to another user", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const otherDiscordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(otherDiscordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Other User Delivery Preview Feed",
        url: "https://example.com/other-delivery-preview.xml",
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-preview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({}),
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 200 when user owns the feed", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Own Feed Delivery Preview",
        url: "https://example.com/own-delivery-preview.xml",
        user: { id: generateTestId(), discordUserId },
      });

      feedApiMockServer.registerRoute(
        "POST",
        `/v1/user-feeds/delivery-preview`,
        deliveryPreviewMockHandler,
      );

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-preview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({}),
        },
      );

      assert.strictEqual(response.status, 200);
    });

    it("returns 200 when user is an accepted shared manager", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const sharedManagerDiscordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(sharedManagerDiscordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Shared Feed Delivery Preview",
        url: "https://example.com/shared-delivery-preview.xml",
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

      feedApiMockServer.registerRoute(
        "POST",
        `/v1/user-feeds/delivery-preview`,
        deliveryPreviewMockHandler,
      );

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-preview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({}),
        },
      );

      assert.strictEqual(response.status, 200);
    });

    it("returns 200 when admin accesses another user's feed", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const adminDiscordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(adminDiscordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const adminUser =
        await ctx.container.usersService.getOrCreateUserByDiscordId(
          adminDiscordUserId,
        );
      ctx.container.config.BACKEND_API_ADMIN_USER_IDS.push(adminUser.id);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Admin Access Delivery Preview Feed",
        url: "https://example.com/admin-delivery-preview.xml",
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      });

      feedApiMockServer.registerRoute(
        "POST",
        `/v1/user-feeds/delivery-preview`,
        deliveryPreviewMockHandler,
      );

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-preview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({}),
        },
      );

      assert.strictEqual(response.status, 200);

      ctx.container.config.BACKEND_API_ADMIN_USER_IDS.pop();
    });

    it("returns 400 when limit is below minimum", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Delivery Preview Limit Validation",
        url: "https://example.com/delivery-preview-limit-validation.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-preview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({ limit: 0 }),
        },
      );

      assert.strictEqual(response.status, 400);
    });

    it("returns 400 when limit exceeds maximum", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Delivery Preview Limit Max Validation",
        url: "https://example.com/delivery-preview-limit-max.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-preview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({ limit: 51 }),
        },
      );

      assert.strictEqual(response.status, 400);
    });

    it("returns 400 when skip is negative", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Delivery Preview Skip Validation",
        url: "https://example.com/delivery-preview-skip-validation.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-preview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({ skip: -1 }),
        },
      );

      assert.strictEqual(response.status, 400);
    });

    it("returns 200 with default skip/limit when body is empty", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Delivery Preview Default Params",
        url: "https://example.com/delivery-preview-default-params.xml",
        user: { id: generateTestId(), discordUserId },
      });

      feedApiMockServer.registerRoute(
        "POST",
        `/v1/user-feeds/delivery-preview`,
        deliveryPreviewMockHandler,
      );

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-preview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({}),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { receivedSkip: number; receivedLimit: number };
      };
      assert.strictEqual(body.result.receivedSkip, 0);
      assert.strictEqual(body.result.receivedLimit, 10);
    });

    it("forwards skip and limit in the upstream request body", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Delivery Preview Forward Params",
        url: "https://example.com/delivery-preview-forward-params.xml",
        user: { id: generateTestId(), discordUserId },
      });

      feedApiMockServer.registerRoute(
        "POST",
        `/v1/user-feeds/delivery-preview`,
        deliveryPreviewMockHandler,
      );

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-preview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({ skip: 5, limit: 20 }),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { receivedSkip: number; receivedLimit: number };
      };
      assert.strictEqual(body.result.receivedSkip, 5);
      assert.strictEqual(body.result.receivedLimit, 20);
    });

    it("filters connections for shared manager with limited connection IDs", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const sharedManagerDiscordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(sharedManagerDiscordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Delivery Preview Filtered Connections",
        url: "https://example.com/delivery-preview-filtered.xml",
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

      feedApiMockServer.registerRoute(
        "POST",
        `/v1/user-feeds/delivery-preview`,
        deliveryPreviewMockHandler,
      );

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-preview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({}),
        },
      );

      assert.strictEqual(response.status, 200);

      const upstreamRequests = feedApiMockServer
        .getRequestsForPath("/v1/user-feeds/delivery-preview")
        .filter(
          (r) =>
            (r.body as Record<string, unknown>)?.feed &&
            (
              (r.body as Record<string, unknown>).feed as Record<
                string,
                unknown
              >
            ).id === feed.id,
        );
      assert.strictEqual(upstreamRequests.length, 1);
      const mediums = (upstreamRequests[0]!.body as Record<string, unknown>)
        .mediums as Array<{ id: string }>;
      assert.strictEqual(mediums.length, 1);
      assert.strictEqual(mediums[0]!.id, firstConnectionId);
    });

    it("shared manager without connection restrictions sees all connections in delivery preview", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const sharedManagerDiscordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(sharedManagerDiscordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Delivery Preview All Connections",
        url: "https://example.com/delivery-preview-all.xml",
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

      feedApiMockServer.registerRoute(
        "POST",
        `/v1/user-feeds/delivery-preview`,
        deliveryPreviewMockHandler,
      );

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/delivery-preview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({}),
        },
      );

      assert.strictEqual(response.status, 200);

      const upstreamRequests = feedApiMockServer
        .getRequestsForPath("/v1/user-feeds/delivery-preview")
        .filter(
          (r) =>
            (r.body as Record<string, unknown>)?.feed &&
            (
              (r.body as Record<string, unknown>).feed as Record<
                string,
                unknown
              >
            ).id === feed.id,
        );
      assert.strictEqual(upstreamRequests.length, 1);
      const mediums = (upstreamRequests[0]!.body as Record<string, unknown>)
        .mediums as Array<{ id: string }>;
      assert.strictEqual(mediums.length, 2);
    });
  },
);

describe(
  "POST /api/v1/user-feeds/:feedId/get-article-properties",
  { concurrency: true },
  () => {
    beforeEach(() => {
      feedApiMockServer.registerRoute(
        "POST",
        "/v1/user-feeds/get-articles",
        (req) => {
          const body = req.body as { url?: string };

          if (body?.url?.includes("invalid-regex")) {
            return {
              status: 422,
              body: {
                code: "CUSTOM_PLACEHOLDER_REGEX_EVAL",
                errors: [{ message: "Invalid regex" }],
              },
            };
          }

          return {
            status: 200,
            body: {
              result: {
                requestStatus: "SUCCESS",
                articles: [{ title: "Article 1" }],
                totalArticles: 1,
                selectedProperties: ["*"],
              },
            },
          };
        },
      );
    });

    it("returns 401 without authentication", async () => {
      const feedId = generateTestId();
      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feedId}/get-article-properties`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 404 for non-existent feed", async () => {
      const mockAccessToken = createMockAccessToken(generateSnowflake());
      const cookies = await ctx.setSession(mockAccessToken);
      const nonExistentId = generateTestId();

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${nonExistentId}/get-article-properties`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({}),
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 200 with properties and requestStatus", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = `https://example.com/article-properties-${generateTestId()}.xml`;

      const feed = await ctx.container.userFeedRepository.create({
        title: "Article Properties Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-article-properties`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({}),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { properties: string[]; requestStatus: string };
      };
      assert.ok(body.result);
      assert.strictEqual(body.result.requestStatus, "SUCCESS");
      assert.ok(Array.isArray(body.result.properties));
    });

    it("returns 200 with empty body (no customPlaceholders)", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Article Properties Empty Body",
        url: "https://example.com/article-properties-empty.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-article-properties`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({}),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { properties: string[]; requestStatus: string };
      };
      assert.ok(body.result);
      assert.strictEqual(body.result.requestStatus, "SUCCESS");
    });

    it("returns 404 when feed belongs to another user", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const otherDiscordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(otherDiscordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Other User Article Props Feed",
        url: "https://example.com/other-article-props.xml",
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-article-properties`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({}),
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 400 for invalid step type", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Step Validation Feed",
        url: `https://example.com/step-invalid-type-${generateTestId()}.xml`,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-article-properties`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            customPlaceholders: [
              {
                referenceName: "test",
                sourcePlaceholder: "title",
                steps: [{ type: "INVALID" }],
              },
            ],
          }),
        },
      );
      assert.strictEqual(response.status, 400);
    });

    it("returns 400 for REGEX step missing regexSearch", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Step Validation Feed",
        url: `https://example.com/step-regex-missing-${generateTestId()}.xml`,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-article-properties`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            customPlaceholders: [
              {
                referenceName: "test",
                sourcePlaceholder: "title",
                steps: [{ type: "REGEX" }],
              },
            ],
          }),
        },
      );
      assert.strictEqual(response.status, 400);
    });

    it("returns 400 for DATE_FORMAT step missing format", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Step Validation Feed",
        url: `https://example.com/step-date-missing-${generateTestId()}.xml`,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-article-properties`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            customPlaceholders: [
              {
                referenceName: "test",
                sourcePlaceholder: "title",
                steps: [{ type: "DATE_FORMAT" }],
              },
            ],
          }),
        },
      );
      assert.strictEqual(response.status, 400);
    });

    it("returns 200 with valid REGEX step", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = `https://example.com/step-regex-valid-${generateTestId()}.xml`;

      const feed = await ctx.container.userFeedRepository.create({
        title: "Step Validation Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-article-properties`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            customPlaceholders: [
              {
                referenceName: "test",
                sourcePlaceholder: "title",
                steps: [
                  {
                    type: "REGEX",
                    regexSearch: "foo",
                    regexSearchFlags: "gi",
                    replacementString: "bar",
                  },
                ],
              },
            ],
          }),
        },
      );
      assert.strictEqual(response.status, 200);
    });

    it("returns 200 with valid URL_ENCODE step", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = `https://example.com/step-urlencode-${generateTestId()}.xml`;

      const feed = await ctx.container.userFeedRepository.create({
        title: "Step Validation Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-article-properties`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            customPlaceholders: [
              {
                referenceName: "test",
                sourcePlaceholder: "title",
                steps: [{ type: "URL_ENCODE" }],
              },
            ],
          }),
        },
      );
      assert.strictEqual(response.status, 200);
    });

    it("returns 200 with valid UPPERCASE and LOWERCASE steps", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = `https://example.com/step-case-${generateTestId()}.xml`;

      const feed = await ctx.container.userFeedRepository.create({
        title: "Step Validation Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-article-properties`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            customPlaceholders: [
              {
                referenceName: "test",
                sourcePlaceholder: "title",
                steps: [{ type: "UPPERCASE" }, { type: "LOWERCASE" }],
              },
            ],
          }),
        },
      );
      assert.strictEqual(response.status, 200);
    });

    it("returns 200 when user is an accepted shared manager", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const sharedManagerDiscordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(sharedManagerDiscordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = `https://example.com/shared-article-props-${generateTestId()}.xml`;

      const feed = await ctx.container.userFeedRepository.create({
        title: "Shared Feed Article Props",
        url: feedUrl,
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

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-article-properties`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({}),
        },
      );
      assert.strictEqual(response.status, 200);
    });

    it("returns 200 when user is admin accessing another user's feed", async () => {
      const adminDiscordUserId = generateSnowflake();
      const ownerDiscordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(adminDiscordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = `https://example.com/admin-article-props-${generateTestId()}.xml`;

      const adminUser =
        await ctx.container.usersService.getOrCreateUserByDiscordId(
          adminDiscordUserId,
        );
      ctx.container.config.BACKEND_API_ADMIN_USER_IDS.push(adminUser.id);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Admin Access Article Props Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-article-properties`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({}),
        },
      );

      assert.strictEqual(response.status, 200);

      ctx.container.config.BACKEND_API_ADMIN_USER_IDS.pop();
    });

    it("returns 200 with explicit null customPlaceholders", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = `https://example.com/null-placeholders-${generateTestId()}.xml`;

      const feed = await ctx.container.userFeedRepository.create({
        title: "Null Placeholders Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-article-properties`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({ customPlaceholders: null }),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { properties: string[]; requestStatus: string };
      };
      assert.ok(body.result);
      assert.strictEqual(body.result.requestStatus, "SUCCESS");
    });

    it("returns 422 for invalid custom placeholder regex", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = `https://example.com/invalid-regex-${generateTestId()}.xml`;

      const feed = await ctx.container.userFeedRepository.create({
        title: "Invalid Regex Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-article-properties`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            customPlaceholders: [
              {
                referenceName: "test",
                sourcePlaceholder: "title",
                steps: [{ type: "REGEX", regexSearch: "[invalid" }],
              },
            ],
          }),
        },
      );
      assert.strictEqual(response.status, 422);
    });
  },
);

describe(
  "POST /api/v1/user-feeds/:feedId/get-articles",
  { concurrency: true },
  () => {
    const capturedBodies = new Map<string, Record<string, unknown>>();

    beforeEach(() => {
      capturedBodies.clear();
      feedApiMockServer.registerRoute(
        "POST",
        "/v1/user-feeds/get-articles",
        (req) => {
          const body = req.body as { url?: string };

          if (body?.url) {
            capturedBodies.set(body.url, req.body as Record<string, unknown>);
          }

          if (body?.url?.includes("invalid-custom-regex")) {
            return {
              status: 422,
              body: {
                code: "CUSTOM_PLACEHOLDER_REGEX_EVAL",
                errors: [{ message: "Invalid regex" }],
              },
            };
          }

          if (body?.url?.includes("invalid-filters-regex")) {
            return {
              status: 422,
              body: {
                code: "FILTERS_REGEX_EVAL",
                errors: [{ message: "Invalid filter regex" }],
              },
            };
          }

          return {
            status: 200,
            body: {
              result: {
                requestStatus: "SUCCESS",
                articles: [{ id: "article-1", title: "Test Article" }],
                totalArticles: 1,
                selectedProperties: ["id", "title"],
              },
            },
          };
        },
      );
    });

    it("returns 401 without authentication", async () => {
      const feedId = generateTestId();
      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feedId}/get-articles`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            formatter: {
              options: {
                formatTables: false,
                stripImages: false,
                disableImageLinkPreviews: false,
              },
            },
          }),
        },
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 404 for non-existent feed", async () => {
      const mockAccessToken = createMockAccessToken(generateSnowflake());
      const cookies = await ctx.setSession(mockAccessToken);
      const feedId = generateTestId();

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feedId}/get-articles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            formatter: {
              options: {
                formatTables: false,
                stripImages: false,
                disableImageLinkPreviews: false,
              },
            },
          }),
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 404 when feed belongs to another user", async () => {
      const ownerDiscordId = generateSnowflake();
      const otherDiscordId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(otherDiscordId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Owner Feed",
        url: "https://example.com/owner-feed-get-articles.xml",
        user: { id: generateTestId(), discordUserId: ownerDiscordId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-articles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            formatter: {
              options: {
                formatTables: false,
                stripImages: false,
                disableImageLinkPreviews: false,
              },
            },
          }),
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 400 when formatter is missing", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Test Feed",
        url: "https://example.com/feed-get-articles-validation.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-articles`,
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

    it("returns 200 with valid request", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Test Feed",
        url: "https://example.com/feed-get-articles-success.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-articles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            formatter: {
              options: {
                formatTables: false,
                stripImages: false,
                disableImageLinkPreviews: false,
              },
            },
          }),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: {
          articles: Array<Record<string, string>>;
          requestStatus: string;
          totalArticles: number;
          selectedProperties: string[];
        };
      };
      assert.ok(body.result);
      assert.strictEqual(body.result.requestStatus, "SUCCESS");
      assert.strictEqual(body.result.totalArticles, 1);
      assert.ok(Array.isArray(body.result.articles));
      assert.ok(Array.isArray(body.result.selectedProperties));
    });

    it("returns 200 with filters and pagination", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Test Feed",
        url: "https://example.com/feed-get-articles-filters.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-articles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            limit: 5,
            skip: 2,
            filters: {
              returnType:
                GetFeedArticlesFilterReturnType.IncludeEvaluationResults,
              search: "test",
            },
            formatter: {
              options: {
                formatTables: false,
                stripImages: false,
                disableImageLinkPreviews: false,
              },
            },
          }),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: {
          articles: Array<Record<string, string>>;
          requestStatus: string;
          totalArticles: number;
        };
      };
      assert.strictEqual(body.result.requestStatus, "SUCCESS");
      assert.ok(Array.isArray(body.result.articles));
    });

    it("merges feed formatOptions into upstream request", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = `https://example.com/feed-get-articles-format-${generateTestId()}.xml`;

      const feed = await ctx.container.userFeedRepository.create({
        title: "Test Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
        formatOptions: {
          dateFormat: "YYYY-MM-DD",
          dateTimezone: "America/New_York",
          dateLocale: "en",
        },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-articles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            formatter: {
              options: {
                formatTables: true,
                stripImages: false,
                disableImageLinkPreviews: false,
              },
            },
          }),
        },
      );

      assert.strictEqual(response.status, 200);
      const capturedBody = capturedBodies.get(feedUrl);
      assert.ok(capturedBody);
      const upstreamBody = capturedBody as {
        formatter: {
          options: {
            dateFormat: string;
            dateTimezone: string;
            dateLocale: string;
            formatTables: boolean;
          };
        };
      };
      assert.strictEqual(
        upstreamBody.formatter.options.dateFormat,
        "YYYY-MM-DD",
      );
      assert.strictEqual(
        upstreamBody.formatter.options.dateTimezone,
        "America/New_York",
      );
      assert.strictEqual(upstreamBody.formatter.options.dateLocale, "en");
      assert.strictEqual(upstreamBody.formatter.options.formatTables, true);
    });

    it("returns 200 when user is an accepted shared manager", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const sharedManagerDiscordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(sharedManagerDiscordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = `https://example.com/shared-get-articles-${generateTestId()}.xml`;

      const feed = await ctx.container.userFeedRepository.create({
        title: "Shared Feed Get Articles",
        url: feedUrl,
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

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-articles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            formatter: {
              options: {
                formatTables: false,
                stripImages: false,
                disableImageLinkPreviews: false,
              },
            },
          }),
        },
      );
      assert.strictEqual(response.status, 200);
    });

    it("returns 200 when user is admin accessing another user's feed", async () => {
      const adminDiscordUserId = generateSnowflake();
      const ownerDiscordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(adminDiscordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = `https://example.com/admin-get-articles-${generateTestId()}.xml`;

      const adminUser =
        await ctx.container.usersService.getOrCreateUserByDiscordId(
          adminDiscordUserId,
        );
      ctx.container.config.BACKEND_API_ADMIN_USER_IDS.push(adminUser.id);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Admin Access Get Articles Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-articles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            formatter: {
              options: {
                formatTables: false,
                stripImages: false,
                disableImageLinkPreviews: false,
              },
            },
          }),
        },
      );

      assert.strictEqual(response.status, 200);

      ctx.container.config.BACKEND_API_ADMIN_USER_IDS.pop();
    });

    it("passes custom placeholders to upstream request", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = `https://example.com/feed-get-articles-placeholders-${generateTestId()}.xml`;

      const feed = await ctx.container.userFeedRepository.create({
        title: "Custom Placeholders Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-articles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            formatter: {
              options: {
                formatTables: false,
                stripImages: false,
                disableImageLinkPreviews: false,
              },
              customPlaceholders: [
                {
                  referenceName: "test",
                  sourcePlaceholder: "title",
                  steps: [
                    {
                      type: "REGEX",
                      regexSearch: "foo",
                      regexSearchFlags: "gi",
                      replacementString: "bar",
                    },
                  ],
                },
              ],
            },
          }),
        },
      );

      assert.strictEqual(response.status, 200);
      const capturedBody = capturedBodies.get(feedUrl);
      assert.ok(capturedBody);
      const upstreamBody = capturedBody as {
        formatter: {
          customPlaceholders: Array<{
            referenceName: string;
            sourcePlaceholder: string;
            steps: Array<{ type: string; regexSearch: string }>;
          }>;
        };
      };
      assert.strictEqual(upstreamBody.formatter.customPlaceholders.length, 1);
      assert.strictEqual(
        upstreamBody.formatter.customPlaceholders[0]!.referenceName,
        "test",
      );
    });

    it("passes external properties to upstream request", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = `https://example.com/feed-get-articles-extprops-${generateTestId()}.xml`;

      const feed = await ctx.container.userFeedRepository.create({
        title: "External Properties Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-articles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            formatter: {
              options: {
                formatTables: false,
                stripImages: false,
                disableImageLinkPreviews: false,
              },
              externalProperties: [
                {
                  id: "ext-1",
                  sourceField: "title",
                  label: "Full Text",
                  cssSelector: ".content",
                },
              ],
            },
          }),
        },
      );

      assert.strictEqual(response.status, 200);
      const capturedBody = capturedBodies.get(feedUrl);
      assert.ok(capturedBody);
      const upstreamBody = capturedBody as {
        formatter: {
          externalProperties: Array<{
            id: string;
            sourceField: string;
            label: string;
            cssSelector: string;
          }>;
        };
      };
      assert.strictEqual(upstreamBody.formatter.externalProperties.length, 1);
      assert.strictEqual(
        upstreamBody.formatter.externalProperties[0]!.sourceField,
        "title",
      );
    });

    it("passes includeHtmlInErrors to upstream request", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = `https://example.com/feed-get-articles-html-errors-${generateTestId()}.xml`;

      const feed = await ctx.container.userFeedRepository.create({
        title: "HTML Errors Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-articles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            includeHtmlInErrors: true,
            formatter: {
              options: {
                formatTables: false,
                stripImages: false,
                disableImageLinkPreviews: false,
              },
            },
          }),
        },
      );

      assert.strictEqual(response.status, 200);
      const capturedBody = capturedBodies.get(feedUrl);
      assert.ok(capturedBody);
      assert.strictEqual(
        (capturedBody as { includeHtmlInErrors: boolean }).includeHtmlInErrors,
        true,
      );
    });

    it("returns 422 for invalid custom placeholder regex from upstream", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Invalid Regex Feed",
        url: `https://example.com/invalid-custom-regex-${generateTestId()}.xml`,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-articles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            formatter: {
              options: {
                formatTables: false,
                stripImages: false,
                disableImageLinkPreviews: false,
              },
            },
          }),
        },
      );
      assert.strictEqual(response.status, 422);
    });

    it("returns 422 for invalid filters regex from upstream", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Invalid Filters Feed",
        url: `https://example.com/invalid-filters-regex-${generateTestId()}.xml`,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-articles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            filters: {
              returnType:
                GetFeedArticlesFilterReturnType.IncludeEvaluationResults,
              expression: {},
            },
            formatter: {
              options: {
                formatTables: false,
                stripImages: false,
                disableImageLinkPreviews: false,
              },
            },
          }),
        },
      );
      assert.strictEqual(response.status, 422);
    });

    it("falls back to user preferences for date options when feed has no formatOptions", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = `https://example.com/feed-get-articles-user-prefs-${generateTestId()}.xml`;

      await ctx.container.usersService.getOrCreateUserByDiscordId(
        discordUserId,
      );
      await ctx.container.userRepository.updatePreferencesByDiscordId(
        discordUserId,
        {
          dateFormat: "DD/MM/YYYY",
          dateTimezone: "Europe/London",
          dateLocale: "en-GB",
        },
      );

      const feed = await ctx.container.userFeedRepository.create({
        title: "User Prefs Fallback Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/get-articles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({
            formatter: {
              options: {
                formatTables: false,
                stripImages: false,
                disableImageLinkPreviews: false,
              },
            },
          }),
        },
      );

      assert.strictEqual(response.status, 200);
      const capturedBody = capturedBodies.get(feedUrl);
      assert.ok(capturedBody);
      const upstreamBody = capturedBody as {
        formatter: {
          options: {
            dateFormat: string;
            dateTimezone: string;
            dateLocale: string;
          };
        };
      };
      assert.strictEqual(
        upstreamBody.formatter.options.dateFormat,
        "DD/MM/YYYY",
      );
      assert.strictEqual(
        upstreamBody.formatter.options.dateTimezone,
        "Europe/London",
      );
      assert.strictEqual(upstreamBody.formatter.options.dateLocale, "en-GB");
    });
  },
);

describe(
  "POST /api/v1/user-feeds/:feedId/manual-request",
  { concurrency: true },
  () => {
    const feedRequestOverrides: Record<string, unknown> = {};
    const getArticlesOverrides: Record<string, unknown> = {};

    beforeEach(() => {
      feedApiMockServer.registerRoute("POST", "/v1/feed-requests", (req) => {
        const reqUrl = (req.body as { url?: string })?.url ?? "";
        const override = feedRequestOverrides[reqUrl];

        if (override) {
          return { status: 200, body: override };
        }

        return {
          status: 200,
          body: {
            requestStatus: "SUCCESS",
            response: { body: "<rss></rss>", statusCode: 200 },
          },
        };
      });

      feedApiMockServer.registerRoute(
        "POST",
        "/v1/user-feeds/get-articles",
        (req) => {
          const reqUrl = (req.body as { url?: string })?.url ?? "";
          const override = getArticlesOverrides[reqUrl];

          if (override) {
            return { status: 200, body: override };
          }

          return {
            status: 200,
            body: {
              result: {
                requestStatus: "SUCCESS",
                articles: [],
                totalArticles: 0,
                selectedProperties: [],
              },
            },
          };
        },
      );
    });

    it("returns 401 without authentication", async () => {
      const feedId = generateTestId();
      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feedId}/manual-request`,
        { method: "POST" },
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 404 for non-existent feed ID", async () => {
      const mockAccessToken = createMockAccessToken(generateSnowflake());
      const cookies = await ctx.setSession(mockAccessToken);
      const nonExistentId = generateTestId();

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${nonExistentId}/manual-request`,
        {
          method: "POST",
          headers: { cookie: cookies },
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 200 with result on success", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Manual Request Feed",
        url: "https://example.com/manual-request-feed.xml",
        user: { id: generateTestId(), discordUserId },
      });

      await ctx.container.userFeedRepository.updateById(feed.id, {
        $set: {
          healthStatus: UserFeedHealthStatus.Failed,
        },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: {
          requestStatus: string;
          hasEnabledFeed: boolean;
        };
      };
      assert.ok(body.result);
      assert.strictEqual(body.result.requestStatus, "SUCCESS");
      assert.strictEqual(body.result.hasEnabledFeed, true);
    });

    it("returns 422 when manual request is too soon", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Manual Request Too Soon Feed",
        url: "https://example.com/manual-request-too-soon.xml",
        user: { id: generateTestId(), discordUserId },
      });

      await ctx.container.userFeedRepository.updateById(feed.id, {
        $set: {
          healthStatus: UserFeedHealthStatus.Failed,
          lastManualRequestAt: new Date(),
        },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 422);
      const body = (await response.json()) as {
        result: { minutesUntilNextRequest: number };
      };
      assert.ok(body.result);
      assert.ok(typeof body.result.minutesUntilNextRequest === "number");
      assert.ok(body.result.minutesUntilNextRequest > 0);
    });

    it("returns 404 when feed belongs to a different user", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const otherDiscordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(otherDiscordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Other User Manual Request Feed",
        url: "https://example.com/other-user-manual-request.xml",
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
          headers: { cookie: cookies },
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 200 when shared manager triggers manual request", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const sharedManagerDiscordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(sharedManagerDiscordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Shared Manager Manual Request Feed",
        url: "https://example.com/shared-manager-manual-request.xml",
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

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { requestStatus: string };
      };
      assert.strictEqual(body.result.requestStatus, "SUCCESS");
    });

    it("returns 200 when admin triggers manual request on another user's feed", async () => {
      const ownerDiscordUserId = generateSnowflake();
      const adminDiscordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(adminDiscordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const adminUser =
        await ctx.container.usersService.getOrCreateUserByDiscordId(
          adminDiscordUserId,
        );
      ctx.container.config.BACKEND_API_ADMIN_USER_IDS.push(adminUser.id);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Admin Manual Request Feed",
        url: "https://example.com/admin-manual-request.xml",
        user: { id: generateTestId(), discordUserId: ownerDiscordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { requestStatus: string };
      };
      assert.strictEqual(body.result.requestStatus, "SUCCESS");

      ctx.container.config.BACKEND_API_ADMIN_USER_IDS.pop();
    });

    it("returns 200 with non-success requestStatus when upstream fetch fails", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = "https://example.com/fetch-fail-manual-request.xml";

      feedRequestOverrides[feedUrl] = {
        requestStatus: "FETCH_ERROR",
      };

      const feed = await ctx.container.userFeedRepository.create({
        title: "Fetch Fail Manual Request Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: {
          requestStatus: string;
          hasEnabledFeed: boolean;
        };
      };
      assert.strictEqual(body.result.requestStatus, "FETCH_ERROR");
      assert.strictEqual(body.result.hasEnabledFeed, false);

      delete feedRequestOverrides[feedUrl];
    });

    it("returns 200 with requestStatusCode when upstream returns BAD_STATUS_CODE", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = "https://example.com/bad-status-manual-request.xml";

      feedRequestOverrides[feedUrl] = {
        requestStatus: "BAD_STATUS_CODE",
        response: { statusCode: 403 },
      };

      const feed = await ctx.container.userFeedRepository.create({
        title: "Bad Status Manual Request Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: {
          requestStatus: string;
          requestStatusCode: number;
          hasEnabledFeed: boolean;
        };
      };
      assert.strictEqual(body.result.requestStatus, "BAD_STATUS_CODE");
      assert.strictEqual(body.result.requestStatusCode, 403);
      assert.strictEqual(body.result.hasEnabledFeed, false);

      delete feedRequestOverrides[feedUrl];
    });

    it("clears disabledCode when fetch succeeds and feed was not disabled with InvalidFeed", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Disabled Manual Request Feed",
        url: "https://example.com/disabled-manual-request.xml",
        user: { id: generateTestId(), discordUserId },
      });

      await ctx.container.userFeedRepository.updateById(feed.id, {
        $set: {
          disabledCode: UserFeedDisabledCode.FailedRequests,
          healthStatus: UserFeedHealthStatus.Failed,
        },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { hasEnabledFeed: boolean };
      };
      assert.strictEqual(body.result.hasEnabledFeed, true);

      const updatedFeed = await ctx.container.userFeedRepository.findById(
        feed.id,
      );
      assert.ok(updatedFeed);
      assert.strictEqual(updatedFeed.disabledCode, undefined);
      assert.strictEqual(updatedFeed.healthStatus, UserFeedHealthStatus.Ok);
    });

    it("does not clear disabledCode when fetch fails", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = "https://example.com/still-disabled-manual-request.xml";

      feedRequestOverrides[feedUrl] = {
        requestStatus: "FETCH_ERROR",
      };

      const feed = await ctx.container.userFeedRepository.create({
        title: "Still Disabled Manual Request Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      await ctx.container.userFeedRepository.updateById(feed.id, {
        $set: {
          disabledCode: UserFeedDisabledCode.FailedRequests,
          healthStatus: UserFeedHealthStatus.Failed,
        },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { hasEnabledFeed: boolean };
      };
      assert.strictEqual(body.result.hasEnabledFeed, false);

      const updatedFeed = await ctx.container.userFeedRepository.findById(
        feed.id,
      );
      assert.ok(updatedFeed);
      assert.strictEqual(
        updatedFeed.disabledCode,
        UserFeedDisabledCode.FailedRequests,
      );
      assert.strictEqual(updatedFeed.healthStatus, UserFeedHealthStatus.Failed);

      delete feedRequestOverrides[feedUrl];
    });

    it("checks article properties when feed disabled with InvalidFeed and re-enables on success", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl = "https://example.com/invalid-feed-manual-request.xml";

      getArticlesOverrides[feedUrl] = {
        result: {
          requestStatus: "SUCCESS",
          articles: [{ title: "Article 1" }],
          totalArticles: 1,
          selectedProperties: ["title"],
        },
      };

      const feed = await ctx.container.userFeedRepository.create({
        title: "InvalidFeed Manual Request Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      await ctx.container.userFeedRepository.updateById(feed.id, {
        $set: {
          disabledCode: UserFeedDisabledCode.InvalidFeed,
          healthStatus: UserFeedHealthStatus.Failed,
        },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: {
          requestStatus: string;
          getArticlesRequestStatus: string;
          hasEnabledFeed: boolean;
        };
      };
      assert.strictEqual(body.result.requestStatus, "SUCCESS");
      assert.strictEqual(body.result.getArticlesRequestStatus, "SUCCESS");
      assert.strictEqual(body.result.hasEnabledFeed, true);

      const updatedFeed = await ctx.container.userFeedRepository.findById(
        feed.id,
      );
      assert.ok(updatedFeed);
      assert.strictEqual(updatedFeed.disabledCode, undefined);

      delete getArticlesOverrides[feedUrl];
    });

    it("does not re-enable when feed disabled with InvalidFeed and article check fails", async () => {
      const discordUserId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(discordUserId);
      const cookies = await ctx.setSession(mockAccessToken);
      const feedUrl =
        "https://example.com/invalid-feed-fail-manual-request.xml";

      getArticlesOverrides[feedUrl] = {
        result: {
          requestStatus: "PARSE_ERROR",
          articles: [],
          totalArticles: 0,
          selectedProperties: [],
        },
      };

      const feed = await ctx.container.userFeedRepository.create({
        title: "InvalidFeed Fail Manual Request Feed",
        url: feedUrl,
        user: { id: generateTestId(), discordUserId },
      });

      await ctx.container.userFeedRepository.updateById(feed.id, {
        $set: {
          disabledCode: UserFeedDisabledCode.InvalidFeed,
          healthStatus: UserFeedHealthStatus.Failed,
        },
      });

      const response = await ctx.fetch(
        `/api/v1/user-feeds/${feed.id}/manual-request`,
        {
          method: "POST",
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: {
          requestStatus: string;
          getArticlesRequestStatus: string;
          hasEnabledFeed: boolean;
        };
      };
      assert.strictEqual(body.result.requestStatus, "SUCCESS");
      assert.strictEqual(body.result.getArticlesRequestStatus, "PARSE_ERROR");
      assert.strictEqual(body.result.hasEnabledFeed, false);

      const updatedFeed = await ctx.container.userFeedRepository.findById(
        feed.id,
      );
      assert.ok(updatedFeed);
      assert.strictEqual(
        updatedFeed.disabledCode,
        UserFeedDisabledCode.InvalidFeed,
      );

      delete getArticlesOverrides[feedUrl];
    });
  },
);

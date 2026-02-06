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

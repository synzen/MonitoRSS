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
      const user = await ctx.asUser(generateSnowflake());
      const nonExistentId = generateTestId();

      const response = await user.fetch(
        `/api/v1/user-feeds/${nonExistentId}/test-send`,
        {
          method: "POST",
          body: JSON.stringify({
            article: { id: "article-1" },
            channelId: "123",
          }),
        },
      );
      assert.strictEqual(response.status, 404);
    });

    it("returns 400 when article is missing", async () => {
      const user = await ctx.asUser(generateSnowflake());
      const feedId = generateTestId();

      const response = await user.fetch(
        `/api/v1/user-feeds/${feedId}/test-send`,
        {
          method: "POST",
          body: JSON.stringify({ channelId: "123" }),
        },
      );
      assert.strictEqual(response.status, 400);
    });

    it("returns 400 when channelId is missing", async () => {
      const user = await ctx.asUser(generateSnowflake());
      const feedId = generateTestId();

      const response = await user.fetch(
        `/api/v1/user-feeds/${feedId}/test-send`,
        {
          method: "POST",
          body: JSON.stringify({ article: { id: "article-1" } }),
        },
      );
      assert.strictEqual(response.status, 400);
    });

    it("returns 200 on successful test send", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
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
        user.accessToken.access_token,
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

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/test-send`,
        {
          method: "POST",
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
      const user = await ctx.asUser(discordUserId);
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

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/test-send`,
        {
          method: "POST",
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
      const user = await ctx.asUser(discordUserId);

      const feed = await ctx.container.userFeedRepository.create({
        title: "Test Send Invalid TZ",
        url: "https://example.com/test-send-invalid-tz.xml",
        user: { id: generateTestId(), discordUserId },
      });

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/test-send`,
        {
          method: "POST",
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
      const user = await ctx.asUser(discordUserId);
      const feedId = generateTestId();

      const response = await user.fetch(
        `/api/v1/user-feeds/${feedId}/test-send`,
        {
          method: "POST",
          body: JSON.stringify({
            article: { id: "article-1" },
            channelId: "123",
            userFeedFormatOptions: null,
          }),
        },
      );
      assert.notStrictEqual(response.status, 500);
    });

    it("returns 200 when channelId is a thread and webhook is requested", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
      const threadId = generateSnowflake();
      const parentChannelId = generateSnowflake();
      const guildId = generateSnowflake();
      const webhookId = generateSnowflake();

      const feed = await ctx.container.userFeedRepository.create({
        title: "Test Send Thread Webhook",
        url: "https://example.com/test-send-thread-webhook.xml",
        user: { id: generateTestId(), discordUserId },
      });

      ctx.discordMockServer.registerRoute("GET", `/channels/${threadId}`, {
        status: 200,
        body: {
          id: threadId,
          guild_id: guildId,
          type: 11,
          parent_id: parentChannelId,
        },
      });

      ctx.discordMockServer.registerRoute(
        "GET",
        `/channels/${parentChannelId}`,
        {
          status: 200,
          body: {
            id: parentChannelId,
            guild_id: guildId,
            type: 0,
          },
        },
      );

      ctx.discordMockServer.registerRoute(
        "GET",
        `/channels/${parentChannelId}/webhooks`,
        {
          status: 200,
          body: [
            {
              id: webhookId,
              type: 1,
              channel_id: parentChannelId,
              name: "test-webhook",
              token: "test-webhook-token",
              application_id: "test-client-id",
            },
          ],
        },
      );

      ctx.discordMockServer.registerRouteForToken(
        "GET",
        "/users/@me/guilds",
        user.accessToken.access_token,
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

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/test-send`,
        {
          method: "POST",
          body: JSON.stringify({
            article: { id: "article-1" },
            channelId: threadId,
            webhook: { name: "My Webhook" },
          }),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { status: string };
      };
      assert.strictEqual(body.result.status, "SUCCESS");

      const webhookRequests = ctx.discordMockServer.getRequestsForPath(
        `/api/v10/channels/${parentChannelId}/webhooks`,
      );
      assert.ok(
        webhookRequests.length > 0,
        "Webhook should be fetched from parent channel, not thread",
      );

      const threadWebhookRequests = ctx.discordMockServer.getRequestsForPath(
        `/api/v10/channels/${threadId}/webhooks`,
      );
      assert.strictEqual(
        threadWebhookRequests.length,
        0,
        "Should not attempt to fetch webhooks from thread",
      );
    });

    it("returns 403 with FEED_USER_MISSING_MANAGE_GUILD when user lacks permission", async () => {
      const discordUserId = generateSnowflake();
      const user = await ctx.asUser(discordUserId);
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
        user.accessToken.access_token,
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

      const response = await user.fetch(
        `/api/v1/user-feeds/${feed.id}/test-send`,
        {
          method: "POST",
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

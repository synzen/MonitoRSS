import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../helpers/test-context";
import { createMockAccessToken } from "../helpers/mock-factories";
import { generateSnowflake } from "../helpers/test-id";

const MANAGE_CHANNEL_PERMISSION = "16";

let ctx: AppTestContext;

before(async () => {
  ctx = await createAppTestContext();
});

after(async () => {
  await ctx.teardown();
});

describe("GET /api/v1/discord-webhooks/:id", { concurrency: true }, () => {
  it("returns 401 without authentication", async () => {
    const webhookId = generateSnowflake();
    const response = await ctx.fetch(`/api/v1/discord-webhooks/${webhookId}`);
    assert.strictEqual(response.status, 401);
  });

  it("returns 404 when webhook not found", async () => {
    const webhookId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(generateSnowflake());

    ctx.discordMockServer.registerRoute("GET", `/webhooks/${webhookId}`, {
      status: 404,
      body: { message: "Unknown Webhook" },
    });

    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch(`/api/v1/discord-webhooks/${webhookId}`, {
      headers: { cookie: cookies },
    });

    assert.strictEqual(response.status, 404);
  });

  it("returns 404 when webhook has no guild_id", async () => {
    const webhookId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(generateSnowflake());

    ctx.discordMockServer.registerRoute("GET", `/webhooks/${webhookId}`, {
      status: 200,
      body: {
        id: webhookId,
        type: 1,
        channel_id: generateSnowflake(),
        name: "Test Webhook",
      },
    });

    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch(`/api/v1/discord-webhooks/${webhookId}`, {
      headers: { cookie: cookies },
    });

    assert.strictEqual(response.status, 404);
  });

  it("returns 404 when user does not manage the guild", async () => {
    const webhookId = generateSnowflake();
    const guildId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(generateSnowflake());

    ctx.discordMockServer.registerRoute("GET", `/webhooks/${webhookId}`, {
      status: 200,
      body: {
        id: webhookId,
        type: 1,
        channel_id: generateSnowflake(),
        name: "Test Webhook",
        guild_id: guildId,
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

    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch(`/api/v1/discord-webhooks/${webhookId}`, {
      headers: { cookie: cookies },
    });

    assert.strictEqual(response.status, 404);
  });

  it("returns 200 with webhook data when all checks pass", async () => {
    const webhookId = generateSnowflake();
    const guildId = generateSnowflake();
    const channelId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(generateSnowflake());

    ctx.discordMockServer.registerRoute("GET", `/webhooks/${webhookId}`, {
      status: 200,
      body: {
        id: webhookId,
        type: 1,
        channel_id: channelId,
        name: "Test Webhook",
        guild_id: guildId,
        avatar: "abc123",
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
            permissions: MANAGE_CHANNEL_PERMISSION,
          },
        ],
      },
    );

    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch(`/api/v1/discord-webhooks/${webhookId}`, {
      headers: { cookie: cookies },
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: {
        id: string;
        name: string;
        channelId: string;
        avatarUrl: string;
      };
    };
    assert.ok(body.result);
    assert.strictEqual(body.result.id, webhookId);
    assert.strictEqual(body.result.name, "Test Webhook");
    assert.strictEqual(body.result.channelId, channelId);
    assert.strictEqual(body.result.avatarUrl, "abc123");
  });

  it("returns 403 when bot lacks permissions to get webhook", async () => {
    const webhookId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(generateSnowflake());

    ctx.discordMockServer.registerRoute("GET", `/webhooks/${webhookId}`, {
      status: 403,
      body: { message: "Missing Permissions" },
    });

    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch(`/api/v1/discord-webhooks/${webhookId}`, {
      headers: { cookie: cookies },
    });

    assert.strictEqual(response.status, 403);
  });

  it("returns 403 when bot gets 401 unauthorized from Discord", async () => {
    const webhookId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(generateSnowflake());

    ctx.discordMockServer.registerRoute("GET", `/webhooks/${webhookId}`, {
      status: 401,
      body: { message: "401: Unauthorized" },
    });

    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch(`/api/v1/discord-webhooks/${webhookId}`, {
      headers: { cookie: cookies },
    });

    assert.strictEqual(response.status, 403);
  });

  it("returns 404 when webhook has null guild_id", async () => {
    const webhookId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(generateSnowflake());

    ctx.discordMockServer.registerRoute("GET", `/webhooks/${webhookId}`, {
      status: 200,
      body: {
        id: webhookId,
        type: 1,
        channel_id: generateSnowflake(),
        name: "Test Webhook",
        guild_id: null,
      },
    });

    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch(`/api/v1/discord-webhooks/${webhookId}`, {
      headers: { cookie: cookies },
    });

    assert.strictEqual(response.status, 404);
  });

  it("returns undefined avatarUrl when webhook avatar is null", async () => {
    const webhookId = generateSnowflake();
    const guildId = generateSnowflake();
    const channelId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(generateSnowflake());

    ctx.discordMockServer.registerRoute("GET", `/webhooks/${webhookId}`, {
      status: 200,
      body: {
        id: webhookId,
        type: 1,
        channel_id: channelId,
        name: "Test Webhook",
        guild_id: guildId,
        avatar: null,
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
            permissions: MANAGE_CHANNEL_PERMISSION,
          },
        ],
      },
    );

    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch(`/api/v1/discord-webhooks/${webhookId}`, {
      headers: { cookie: cookies },
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: {
        id: string;
        name: string;
        channelId: string;
        avatarUrl?: string;
      };
    };
    assert.ok(body.result);
    assert.strictEqual(body.result.avatarUrl, undefined);
  });
});

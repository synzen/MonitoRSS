import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../helpers/test-context";
import { createMockAccessToken } from "../helpers/mock-factories";
import { generateSnowflake } from "../helpers/test-id";

let ctx: AppTestContext;

before(async () => {
  ctx = await createAppTestContext();
});

after(async () => {
  await ctx.teardown();
});

describe("GET /api/v1/discord-users/bot", { concurrency: true }, () => {
  it("returns 401 without authentication", async () => {
    const response = await ctx.fetch("/api/v1/discord-users/bot");
    assert.strictEqual(response.status, 401);
  });

  it("returns 200 with bot info when authenticated", async () => {
    const mockAccessToken = createMockAccessToken(generateSnowflake());

    ctx.discordMockServer.registerRoute("GET", "/users/test-client-id", {
      status: 200,
      body: {
        id: "bot-123",
        username: "TestBot",
        avatar: "abc123",
      },
    });

    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch("/api/v1/discord-users/bot", {
      headers: { cookie: cookies },
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: {
        id: string;
        username: string;
        avatar: string | null;
        inviteLink: string;
      };
    };
    assert.ok(body.result);
    assert.strictEqual(body.result.id, "bot-123");
    assert.strictEqual(body.result.username, "TestBot");
    assert.ok(body.result.inviteLink);
    assert.ok(body.result.inviteLink.includes("client_id=test-client-id"));
    assert.ok(body.result.inviteLink.includes("permissions=19456"));
  });
});

describe("GET /api/v1/discord-users/@me", { concurrency: true }, () => {
  it("returns 401 without authentication", async () => {
    const response = await ctx.fetch("/api/v1/discord-users/@me");
    assert.strictEqual(response.status, 401);
  });
});

describe(
  "GET /api/v1/discord-users/@me/auth-status",
  { concurrency: true },
  () => {
    it("returns authenticated: false without session cookie", async () => {
      const response = await ctx.fetch("/api/v1/discord-users/@me/auth-status");
      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as { authenticated: boolean };
      assert.strictEqual(body.authenticated, false);
    });

    it("returns authenticated: true when token is valid", async () => {
      const userId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(userId);

      ctx.discordMockServer.registerRouteForToken(
        "GET",
        "/users/@me",
        mockAccessToken.access_token,
        {
          status: 200,
          body: {
            id: userId,
            username: "TestUser",
            discriminator: "0",
            avatar: "abc123",
          },
        },
      );

      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        "/api/v1/discord-users/@me/auth-status",
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as { authenticated: boolean };
      assert.strictEqual(body.authenticated, true);
    });

    it("returns authenticated: false and clears session when Discord returns 401", async () => {
      const mockAccessToken = createMockAccessToken(generateSnowflake());

      ctx.discordMockServer.registerRouteForToken(
        "GET",
        "/users/@me",
        mockAccessToken.access_token,
        {
          status: 401,
          body: { message: "401: Unauthorized" },
        },
      );

      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        "/api/v1/discord-users/@me/auth-status",
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as { authenticated: boolean };
      assert.strictEqual(body.authenticated, false);
    });

    it("returns authenticated: false and clears session when Discord returns 403", async () => {
      const mockAccessToken = createMockAccessToken(generateSnowflake());

      ctx.discordMockServer.registerRouteForToken(
        "GET",
        "/users/@me",
        mockAccessToken.access_token,
        {
          status: 403,
          body: { message: "403: Forbidden" },
        },
      );

      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        "/api/v1/discord-users/@me/auth-status",
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as { authenticated: boolean };
      assert.strictEqual(body.authenticated, false);
    });

    it("propagates unexpected errors from Discord API", async () => {
      const mockAccessToken = createMockAccessToken(generateSnowflake());

      ctx.discordMockServer.registerRouteForToken(
        "GET",
        "/users/@me",
        mockAccessToken.access_token,
        {
          status: 500,
          body: { message: "500: Internal Server Error" },
        },
      );

      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        "/api/v1/discord-users/@me/auth-status",
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 500);
    });
  },
);

describe("GET /api/v1/discord-users/:id", { concurrency: true }, () => {
  it("returns 401 without authentication", async () => {
    const response = await ctx.fetch("/api/v1/discord-users/123456789");
    assert.strictEqual(response.status, 401);
  });

  it("returns user info when authenticated", async () => {
    const userId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(generateSnowflake());

    ctx.discordMockServer.registerRoute("GET", `/users/${userId}`, {
      status: 200,
      body: {
        id: userId,
        username: "TargetUser",
        discriminator: "0",
        avatar: "def456",
      },
    });

    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch(`/api/v1/discord-users/${userId}`, {
      headers: { cookie: cookies },
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: {
        id: string;
        username: string;
        avatarUrl: string | null;
      };
    };
    assert.ok(body.result);
    assert.strictEqual(body.result.id, userId);
    assert.strictEqual(body.result.username, "TargetUser");
    assert.strictEqual(
      body.result.avatarUrl,
      `https://cdn.discordapp.com/avatars/${userId}/def456.png`,
    );
  });

  it("returns animated gif avatar URL for animated avatars", async () => {
    const userId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(generateSnowflake());

    ctx.discordMockServer.registerRoute("GET", `/users/${userId}`, {
      status: 200,
      body: {
        id: userId,
        username: "AnimatedUser",
        discriminator: "0",
        avatar: "a_animated123",
      },
    });

    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch(`/api/v1/discord-users/${userId}`, {
      headers: { cookie: cookies },
    });

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      result: {
        id: string;
        username: string;
        avatarUrl: string | null;
      };
    };
    assert.ok(body.result);
    assert.strictEqual(body.result.id, userId);
    assert.strictEqual(
      body.result.avatarUrl,
      `https://cdn.discordapp.com/avatars/${userId}/a_animated123.gif`,
    );
  });
});

describe(
  "GET /api/v1/discord-users/@me - with supporter",
  { concurrency: false },
  () => {
    let supporterCtx: AppTestContext;

    before(async () => {
      supporterCtx = await createAppTestContext({
        configOverrides: {
          BACKEND_API_ENABLE_SUPPORTERS: true,
        },
      });
    });

    after(async () => {
      await supporterCtx.teardown();
    });

    it("returns user profile and supporter benefits", async () => {
      const userId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(userId);

      supporterCtx.discordMockServer.registerRouteForToken(
        "GET",
        "/users/@me",
        mockAccessToken.access_token,
        {
          status: 200,
          body: {
            id: userId,
            username: "TestUser",
            discriminator: "0",
            avatar: "abc123",
          },
        },
      );

      await supporterCtx.createSupporter({
        id: userId,
        guilds: ["guild-1", "guild-2"],
        expireAt: new Date("2030-12-31"),
        maxFeeds: 100,
        maxUserFeeds: 50,
        maxGuilds: 10,
        allowCustomPlaceholders: true,
      });

      const cookies = await supporterCtx.setSession(mockAccessToken);

      const response = await supporterCtx.fetch("/api/v1/discord-users/@me", {
        headers: { cookie: cookies },
      });

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        id: string;
        username: string;
        iconUrl: string;
        maxFeeds: number;
        maxUserFeeds: number;
        maxUserFeedsComposition: { base: number; legacy: number };
        allowCustomPlaceholders?: boolean;
        supporter?: {
          guilds: string[];
          maxFeeds: number;
          maxGuilds: number;
          expireAt?: string;
        };
      };
      assert.strictEqual(body.id, userId);
      assert.strictEqual(body.username, "TestUser");
      assert.strictEqual(
        body.iconUrl,
        `https://cdn.discordapp.com/avatars/${userId}/abc123.png`,
      );
      assert.strictEqual(body.maxFeeds, 100);
      assert.strictEqual(body.maxUserFeeds, 50);
      assert.deepStrictEqual(body.maxUserFeedsComposition, {
        base: 50,
        legacy: 0,
      });
      assert.strictEqual(body.allowCustomPlaceholders, true);
      assert.ok(body.supporter);
      assert.deepStrictEqual(body.supporter.guilds, ["guild-1", "guild-2"]);
      assert.strictEqual(body.supporter.maxFeeds, 100);
      assert.strictEqual(body.supporter.maxGuilds, 10);
    });

    it("returns user profile without supporter object when user has no supporter record", async () => {
      const userId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(userId);

      supporterCtx.discordMockServer.registerRouteForToken(
        "GET",
        "/users/@me",
        mockAccessToken.access_token,
        {
          status: 200,
          body: {
            id: userId,
            username: "RegularUser",
            discriminator: "0",
            avatar: "regular123",
          },
        },
      );

      const cookies = await supporterCtx.setSession(mockAccessToken);

      const response = await supporterCtx.fetch("/api/v1/discord-users/@me", {
        headers: { cookie: cookies },
      });

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        id: string;
        username: string;
        iconUrl: string;
        maxFeeds: number;
        maxUserFeeds: number;
        maxUserFeedsComposition: { base: number; legacy: number };
        allowCustomPlaceholders?: boolean;
        supporter?: unknown;
      };
      assert.strictEqual(body.id, userId);
      assert.strictEqual(body.username, "RegularUser");
      assert.strictEqual(
        body.iconUrl,
        `https://cdn.discordapp.com/avatars/${userId}/regular123.png`,
      );
      assert.strictEqual(body.supporter, undefined);
      assert.ok(body.maxFeeds > 0);
      assert.ok(body.maxUserFeeds > 0);
      assert.ok(body.maxUserFeedsComposition);
    });
  },
);

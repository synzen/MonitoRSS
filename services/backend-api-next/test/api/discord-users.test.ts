import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../helpers/test-context";
import type { SessionAccessToken } from "../../src/services/discord-auth/types";

describe("Discord Users API", { concurrency: true }, () => {
  let ctx: AppTestContext;

  before(async () => {
    ctx = await createAppTestContext();
  });

  after(async () => {
    await ctx.teardown();
  });

  describe("GET /api/v1/discord-users/bot", () => {
    it("returns 401 without authentication", async () => {
      const response = await ctx.fetch("/api/v1/discord-users/bot");
      assert.strictEqual(response.status, 401);
    });
  });

  describe("GET /api/v1/discord-users/@me", () => {
    it("returns 401 without authentication", async () => {
      const response = await ctx.fetch("/api/v1/discord-users/@me");
      assert.strictEqual(response.status, 401);
    });
  });

  describe("GET /api/v1/discord-users/@me/auth-status", () => {
    it("returns authenticated: false without session cookie", async () => {
      const response = await ctx.fetch("/api/v1/discord-users/@me/auth-status");
      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as { authenticated: boolean };
      assert.strictEqual(body.authenticated, false);
    });
  });

  describe("GET /api/v1/discord-users/:id", () => {
    it("returns 401 without authentication", async () => {
      const response = await ctx.fetch("/api/v1/discord-users/123456789");
      assert.strictEqual(response.status, 401);
    });
  });
});

describe(
  "GET /api/v1/discord-users/bot - Authenticated",
  { concurrency: false },
  () => {
    let ctx: AppTestContext;
    const mockAccessToken: SessionAccessToken = {
      access_token: "mock-access-token",
      token_type: "Bearer",
      expires_in: 604800,
      refresh_token: "mock-refresh-token",
      scope: "identify guilds",
      expiresAt: Math.floor(Date.now() / 1000) + 604800,
      discord: { id: "123456789" },
    };

    before(async () => {
      ctx = await createAppTestContext();

      ctx.discordMockServer.registerRoute("GET", "/users/test-client-id", {
        status: 200,
        body: {
          id: "bot-123",
          username: "TestBot",
          avatar: "abc123",
        },
      });
    });

    after(async () => {
      await ctx.teardown();
    });

    it("returns 200 with bot info when authenticated", async () => {
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
  },
);

describe(
  "GET /api/v1/discord-users/@me - Authenticated with supporter",
  { concurrency: false },
  () => {
    let ctx: AppTestContext;
    const mockAccessToken: SessionAccessToken = {
      access_token: "mock-access-token",
      token_type: "Bearer",
      expires_in: 604800,
      refresh_token: "mock-refresh-token",
      scope: "identify guilds",
      expiresAt: Math.floor(Date.now() / 1000) + 604800,
      discord: { id: "user-123" },
    };

    before(async () => {
      ctx = await createAppTestContext({
        configOverrides: {
          BACKEND_API_ENABLE_SUPPORTERS: true,
        },
      });

      ctx.discordMockServer.registerRoute("GET", "/users/@me", {
        status: 200,
        body: {
          id: "user-123",
          username: "TestUser",
          discriminator: "0",
          avatar: "abc123",
        },
      });

      await ctx.createSupporter({
        id: "user-123",
        guilds: ["guild-1", "guild-2"],
        expireAt: new Date("2030-12-31"),
        maxFeeds: 100,
        maxUserFeeds: 50,
        maxGuilds: 10,
        allowCustomPlaceholders: true,
      });
    });

    after(async () => {
      await ctx.teardown();
    });

    it("returns user profile and supporter benefits", async () => {
      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch("/api/v1/discord-users/@me", {
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
      assert.strictEqual(body.id, "user-123");
      assert.strictEqual(body.username, "TestUser");
      assert.strictEqual(
        body.iconUrl,
        "https://cdn.discordapp.com/avatars/user-123/abc123.png",
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
  },
);

describe(
  "GET /api/v1/discord-users/@me - Authenticated without supporter",
  { concurrency: false },
  () => {
    let ctx: AppTestContext;
    const mockAccessToken: SessionAccessToken = {
      access_token: "mock-access-token",
      token_type: "Bearer",
      expires_in: 604800,
      refresh_token: "mock-refresh-token",
      scope: "identify guilds",
      expiresAt: Math.floor(Date.now() / 1000) + 604800,
      discord: { id: "non-supporter-user" },
    };

    before(async () => {
      ctx = await createAppTestContext({
        configOverrides: {
          BACKEND_API_ENABLE_SUPPORTERS: true,
        },
      });

      ctx.discordMockServer.registerRoute("GET", "/users/@me", {
        status: 200,
        body: {
          id: "non-supporter-user",
          username: "RegularUser",
          discriminator: "0",
          avatar: "regular123",
        },
      });
    });

    after(async () => {
      await ctx.teardown();
    });

    it("returns user profile without supporter object when user has no supporter record", async () => {
      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch("/api/v1/discord-users/@me", {
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
      assert.strictEqual(body.id, "non-supporter-user");
      assert.strictEqual(body.username, "RegularUser");
      assert.strictEqual(
        body.iconUrl,
        "https://cdn.discordapp.com/avatars/non-supporter-user/regular123.png",
      );
      assert.strictEqual(body.supporter, undefined);
      assert.ok(body.maxFeeds > 0);
      assert.ok(body.maxUserFeeds > 0);
      assert.ok(body.maxUserFeedsComposition);
    });
  },
);

describe(
  "GET /api/v1/discord-users/@me/auth-status - Authenticated",
  { concurrency: false },
  () => {
    let ctx: AppTestContext;
    const mockAccessToken: SessionAccessToken = {
      access_token: "mock-access-token",
      token_type: "Bearer",
      expires_in: 604800,
      refresh_token: "mock-refresh-token",
      scope: "identify guilds",
      expiresAt: Math.floor(Date.now() / 1000) + 604800,
      discord: { id: "user-123" },
    };

    before(async () => {
      ctx = await createAppTestContext();
    });

    after(async () => {
      await ctx.teardown();
    });

    it("returns authenticated: true when token is valid", async () => {
      ctx.discordMockServer.registerRoute("GET", "/users/@me", {
        status: 200,
        body: {
          id: "user-123",
          username: "TestUser",
          discriminator: "0",
          avatar: "abc123",
        },
      });

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
      ctx.discordMockServer.registerRoute("GET", "/users/@me", {
        status: 401,
        body: {
          message: "401: Unauthorized",
        },
      });

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
      ctx.discordMockServer.registerRoute("GET", "/users/@me", {
        status: 403,
        body: {
          message: "403: Forbidden",
        },
      });

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
      ctx.discordMockServer.registerRoute("GET", "/users/@me", {
        status: 500,
        body: {
          message: "500: Internal Server Error",
        },
      });

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

describe(
  "GET /api/v1/discord-users/:id - Authenticated",
  { concurrency: false },
  () => {
    let ctx: AppTestContext;
    const mockAccessToken: SessionAccessToken = {
      access_token: "mock-access-token",
      token_type: "Bearer",
      expires_in: 604800,
      refresh_token: "mock-refresh-token",
      scope: "identify guilds",
      expiresAt: Math.floor(Date.now() / 1000) + 604800,
      discord: { id: "123456789" },
    };

    before(async () => {
      ctx = await createAppTestContext();

      ctx.discordMockServer.registerRoute("GET", "/users/target-user-456", {
        status: 200,
        body: {
          id: "target-user-456",
          username: "TargetUser",
          discriminator: "0",
          avatar: "def456",
        },
      });

      ctx.discordMockServer.registerRoute(
        "GET",
        "/users/animated-avatar-user",
        {
          status: 200,
          body: {
            id: "animated-avatar-user",
            username: "AnimatedUser",
            discriminator: "0",
            avatar: "a_animated123",
          },
        },
      );
    });

    after(async () => {
      await ctx.teardown();
    });

    it("returns user info when authenticated", async () => {
      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        "/api/v1/discord-users/target-user-456",
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: {
          id: string;
          username: string;
          avatarUrl: string | null;
        };
      };
      assert.ok(body.result);
      assert.strictEqual(body.result.id, "target-user-456");
      assert.strictEqual(body.result.username, "TargetUser");
      assert.strictEqual(
        body.result.avatarUrl,
        "https://cdn.discordapp.com/avatars/target-user-456/def456.png",
      );
    });

    it("returns animated gif avatar URL for animated avatars", async () => {
      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        "/api/v1/discord-users/animated-avatar-user",
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: {
          id: string;
          username: string;
          avatarUrl: string | null;
        };
      };
      assert.ok(body.result);
      assert.strictEqual(body.result.id, "animated-avatar-user");
      assert.strictEqual(
        body.result.avatarUrl,
        "https://cdn.discordapp.com/avatars/animated-avatar-user/a_animated123.gif",
      );
    });
  },
);

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../helpers/test-context";
import { generateSnowflake } from "../helpers/test-id";

const MANAGE_CHANNEL_PERMISSION = "16";

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
    const user = await ctx.asUser(generateSnowflake());

    ctx.discordMockServer.registerRoute("GET", "/users/test-client-id", {
      status: 200,
      body: {
        id: "bot-123",
        username: "TestBot",
        avatar: "abc123",
      },
    });

    const response = await user.fetch("/api/v1/discord-users/bot");

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
      const user = await ctx.asUser(userId);

      ctx.discordMockServer.registerRouteForToken(
        "GET",
        "/users/@me",
        user.accessToken.access_token,
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

      const response = await user.fetch(
        "/api/v1/discord-users/@me/auth-status",
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as { authenticated: boolean };
      assert.strictEqual(body.authenticated, true);
    });

    it("returns authenticated: false and clears session when Discord returns 401", async () => {
      const user = await ctx.asUser(generateSnowflake());

      ctx.discordMockServer.registerRouteForToken(
        "GET",
        "/users/@me",
        user.accessToken.access_token,
        {
          status: 401,
          body: { message: "401: Unauthorized" },
        },
      );

      const response = await user.fetch(
        "/api/v1/discord-users/@me/auth-status",
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as { authenticated: boolean };
      assert.strictEqual(body.authenticated, false);
    });

    it("returns authenticated: false and clears session when Discord returns 403", async () => {
      const user = await ctx.asUser(generateSnowflake());

      ctx.discordMockServer.registerRouteForToken(
        "GET",
        "/users/@me",
        user.accessToken.access_token,
        {
          status: 403,
          body: { message: "403: Forbidden" },
        },
      );

      const response = await user.fetch(
        "/api/v1/discord-users/@me/auth-status",
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as { authenticated: boolean };
      assert.strictEqual(body.authenticated, false);
    });

    it("propagates unexpected errors from Discord API", async () => {
      const user = await ctx.asUser(generateSnowflake());

      ctx.discordMockServer.registerRouteForToken(
        "GET",
        "/users/@me",
        user.accessToken.access_token,
        {
          status: 500,
          body: { message: "500: Internal Server Error" },
        },
      );

      const response = await user.fetch(
        "/api/v1/discord-users/@me/auth-status",
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
    const user = await ctx.asUser(generateSnowflake());

    ctx.discordMockServer.registerRoute("GET", `/users/${userId}`, {
      status: 200,
      body: {
        id: userId,
        username: "TargetUser",
        discriminator: "0",
        avatar: "def456",
      },
    });

    const response = await user.fetch(`/api/v1/discord-users/${userId}`);

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
    const user = await ctx.asUser(generateSnowflake());

    ctx.discordMockServer.registerRoute("GET", `/users/${userId}`, {
      status: 200,
      body: {
        id: userId,
        username: "AnimatedUser",
        discriminator: "0",
        avatar: "a_animated123",
      },
    });

    const response = await user.fetch(`/api/v1/discord-users/${userId}`);

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
      const user = await supporterCtx.asUser(userId);

      supporterCtx.discordMockServer.registerRouteForToken(
        "GET",
        "/users/@me",
        user.accessToken.access_token,
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

      const response = await user.fetch("/api/v1/discord-users/@me");

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
      const user = await supporterCtx.asUser(userId);

      supporterCtx.discordMockServer.registerRouteForToken(
        "GET",
        "/users/@me",
        user.accessToken.access_token,
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

      const response = await user.fetch("/api/v1/discord-users/@me");

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

describe("GET /api/v1/discord-users/@me/servers", { concurrency: true }, () => {
  it("returns 401 without authentication", async () => {
    const response = await ctx.fetch("/api/v1/discord-users/@me/servers");
    assert.strictEqual(response.status, 401);
  });

  it("returns servers with correct shape", async () => {
    const user = await ctx.asUser(generateSnowflake());
    const serverId = generateSnowflake();

    ctx.discordMockServer.registerRouteForToken(
      "GET",
      "/users/@me/guilds",
      user.accessToken.access_token,
      {
        status: 200,
        body: [
          {
            id: serverId,
            name: "Test Server",
            icon: "abc123",
            owner: false,
            permissions: MANAGE_CHANNEL_PERMISSION,
          },
        ],
      },
    );

    const response = await user.fetch("/api/v1/discord-users/@me/servers");

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      results: Array<{
        id: string;
        name: string;
        iconUrl: string;
        benefits: {
          maxFeeds: number;
          webhooks: boolean;
        };
      }>;
      total: number;
    };

    assert.ok(body.results);
    assert.strictEqual(body.total, 1);
    const server = body.results[0];
    assert.ok(server);
    assert.strictEqual(server.id, serverId);
    assert.strictEqual(server.name, "Test Server");
    assert.strictEqual(
      server.iconUrl,
      `https://cdn.discordapp.com/icons/${serverId}/abc123.png?size=128`,
    );
    assert.ok(server.benefits);
    assert.strictEqual(typeof server.benefits.maxFeeds, "number");
    assert.strictEqual(typeof server.benefits.webhooks, "boolean");
  });

  it("only returns servers where user has MANAGE_CHANNEL permission", async () => {
    const user = await ctx.asUser(generateSnowflake());
    const serverWithPermission = generateSnowflake();
    const serverWithoutPermission = generateSnowflake();

    ctx.discordMockServer.registerRouteForToken(
      "GET",
      "/users/@me/guilds",
      user.accessToken.access_token,
      {
        status: 200,
        body: [
          {
            id: serverWithPermission,
            name: "Server With Permission",
            icon: "icon1",
            owner: false,
            permissions: MANAGE_CHANNEL_PERMISSION,
          },
          {
            id: serverWithoutPermission,
            name: "Server Without Permission",
            icon: "icon2",
            owner: false,
            permissions: "0",
          },
        ],
      },
    );

    const response = await user.fetch("/api/v1/discord-users/@me/servers");

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      results: Array<{ id: string; name: string }>;
      total: number;
    };

    assert.strictEqual(body.total, 1);
    assert.strictEqual(body.results.length, 1);
    const server = body.results[0];
    assert.ok(server);
    assert.strictEqual(server.id, serverWithPermission);
    assert.strictEqual(server.name, "Server With Permission");
  });

  it("includes servers where user is owner", async () => {
    const user = await ctx.asUser(generateSnowflake());
    const ownedServerId = generateSnowflake();

    ctx.discordMockServer.registerRouteForToken(
      "GET",
      "/users/@me/guilds",
      user.accessToken.access_token,
      {
        status: 200,
        body: [
          {
            id: ownedServerId,
            name: "Owned Server",
            icon: "ownericon",
            owner: true,
            permissions: "0",
          },
        ],
      },
    );

    const response = await user.fetch("/api/v1/discord-users/@me/servers");

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      results: Array<{ id: string; name: string }>;
      total: number;
    };

    assert.strictEqual(body.total, 1);
    const server = body.results[0];
    assert.ok(server);
    assert.strictEqual(server.id, ownedServerId);
    assert.strictEqual(server.name, "Owned Server");
  });

  it("returns empty results when user has no eligible servers", async () => {
    const user = await ctx.asUser(generateSnowflake());

    ctx.discordMockServer.registerRouteForToken(
      "GET",
      "/users/@me/guilds",
      user.accessToken.access_token,
      {
        status: 200,
        body: [
          {
            id: generateSnowflake(),
            name: "No Permission Server",
            icon: "icon",
            owner: false,
            permissions: "0",
          },
        ],
      },
    );

    const response = await user.fetch("/api/v1/discord-users/@me/servers");

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      results: Array<unknown>;
      total: number;
    };

    assert.strictEqual(body.total, 0);
    assert.deepStrictEqual(body.results, []);
  });

  it("returns empty results when Discord returns no guilds", async () => {
    const user = await ctx.asUser(generateSnowflake());

    ctx.discordMockServer.registerRouteForToken(
      "GET",
      "/users/@me/guilds",
      user.accessToken.access_token,
      {
        status: 200,
        body: [],
      },
    );

    const response = await user.fetch("/api/v1/discord-users/@me/servers");

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      results: Array<unknown>;
      total: number;
    };

    assert.strictEqual(body.total, 0);
    assert.deepStrictEqual(body.results, []);
  });

  it("propagates Discord API errors", async () => {
    const user = await ctx.asUser(generateSnowflake());

    ctx.discordMockServer.registerRouteForToken(
      "GET",
      "/users/@me/guilds",
      user.accessToken.access_token,
      {
        status: 500,
        body: { message: "500: Internal Server Error" },
      },
    );

    const response = await user.fetch("/api/v1/discord-users/@me/servers");

    assert.strictEqual(response.status, 500);
  });

  it("returns multiple servers with varying permissions", async () => {
    const user = await ctx.asUser(generateSnowflake());
    const serverId1 = generateSnowflake();
    const serverId2 = generateSnowflake();
    const serverId3 = generateSnowflake();

    ctx.discordMockServer.registerRouteForToken(
      "GET",
      "/users/@me/guilds",
      user.accessToken.access_token,
      {
        status: 200,
        body: [
          {
            id: serverId1,
            name: "Server 1",
            icon: "icon1",
            owner: true,
            permissions: "0",
          },
          {
            id: serverId2,
            name: "Server 2",
            icon: "icon2",
            owner: false,
            permissions: MANAGE_CHANNEL_PERMISSION,
          },
          {
            id: serverId3,
            name: "Server 3",
            icon: "icon3",
            owner: false,
            permissions: "8",
          },
        ],
      },
    );

    const response = await user.fetch("/api/v1/discord-users/@me/servers");

    assert.strictEqual(response.status, 200);
    const body = (await response.json()) as {
      results: Array<{ id: string; name: string }>;
      total: number;
    };

    assert.strictEqual(body.total, 2);
    assert.strictEqual(body.results.length, 2);

    const serverIds = body.results.map((s) => s.id);
    assert.ok(serverIds.includes(serverId1));
    assert.ok(serverIds.includes(serverId2));
    assert.ok(!serverIds.includes(serverId3));
  });
});

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../helpers/test-context";
import type { SessionAccessToken } from "../../src/services/discord-auth/types";

const MANAGE_CHANNEL_PERMISSION = "16";

function createMockAccessToken(userId: string): SessionAccessToken {
  return {
    access_token: "mock-access-token",
    token_type: "Bearer",
    expires_in: 604800,
    refresh_token: "mock-refresh-token",
    scope: "identify guilds",
    expiresAt: Math.floor(Date.now() / 1000) + 604800,
    discord: { id: userId },
  };
}

let ctx: AppTestContext;

before(async () => {
  ctx = await createAppTestContext();
});

after(async () => {
  await ctx.teardown();
});

describe("GET /api/v1/discord-servers/:serverId", { concurrency: true }, () => {
  const serverId = "server-unauth-100";

  it("returns 401 without authentication", async () => {
    const response = await ctx.fetch(`/api/v1/discord-servers/${serverId}`);
    assert.strictEqual(response.status, 401);
  });
});

describe(
  "GET /api/v1/discord-servers/:serverId - Bot not in server",
  { concurrency: true },
  () => {
    const serverId = "server-bot-missing-101";
    const mockAccessToken = createMockAccessToken("user-101");

    before(() => {
      ctx.discordMockServer.registerRoute("GET", `/guilds/${serverId}`, {
        status: 404,
        body: { message: "Unknown Guild" },
      });
    });

    it("returns 404 when bot is not in the server", async () => {
      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(`/api/v1/discord-servers/${serverId}`, {
        headers: { cookie: cookies },
      });

      assert.strictEqual(response.status, 404);
    });
  },
);

describe(
  "GET /api/v1/discord-servers/:serverId - User lacks permission",
  { concurrency: true },
  () => {
    const serverId = "server-no-perm-102";
    const mockAccessToken = createMockAccessToken("user-102");

    before(() => {
      ctx.discordMockServer.registerRoute("GET", `/guilds/${serverId}`, {
        status: 200,
        body: { id: serverId, name: "Test Server" },
      });

      ctx.discordMockServer.registerRoute("GET", "/users/@me/guilds", {
        status: 200,
        body: [
          {
            id: serverId,
            name: "Test Server",
            owner: false,
            permissions: "0",
          },
        ],
      });
    });

    it("returns 403 when user lacks permission to manage server", async () => {
      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(`/api/v1/discord-servers/${serverId}`, {
        headers: { cookie: cookies },
      });

      assert.strictEqual(response.status, 403);
    });
  },
);

describe(
  "GET /api/v1/discord-servers/:serverId - Success",
  { concurrency: true },
  () => {
    const serverId = "server-success-103";
    const mockAccessToken = createMockAccessToken("user-103");

    before(() => {
      ctx.discordMockServer.registerRoute("GET", `/guilds/${serverId}`, {
        status: 200,
        body: { id: serverId, name: "Test Server" },
      });

      ctx.discordMockServer.registerRoute("GET", "/users/@me/guilds", {
        status: 200,
        body: [
          {
            id: serverId,
            name: "Test Server",
            owner: false,
            permissions: MANAGE_CHANNEL_PERMISSION,
          },
        ],
      });
    });

    it("returns 200 with profile and includesBot when all checks pass", async () => {
      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(`/api/v1/discord-servers/${serverId}`, {
        headers: { cookie: cookies },
      });

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: {
          profile: {
            dateFormat: string;
            timezone: string;
            dateLanguage: string;
          };
          includesBot: boolean;
        };
      };
      assert.ok(body.result);
      assert.ok(body.result.profile);
      assert.strictEqual(typeof body.result.profile.dateFormat, "string");
      assert.strictEqual(typeof body.result.profile.timezone, "string");
      assert.strictEqual(typeof body.result.profile.dateLanguage, "string");
      assert.strictEqual(body.result.includesBot, true);
    });
  },
);

describe(
  "GET /api/v1/discord-servers/:serverId/active-threads",
  { concurrency: true },
  () => {
    const serverId = "server-threads-unauth-200";

    it("returns 401 without authentication", async () => {
      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/active-threads`,
      );
      assert.strictEqual(response.status, 401);
    });
  },
);

describe(
  "GET /api/v1/discord-servers/:serverId/active-threads - Bot not in server",
  { concurrency: true },
  () => {
    const serverId = "server-threads-bot-missing-201";
    const mockAccessToken = createMockAccessToken("user-201");

    before(() => {
      ctx.discordMockServer.registerRoute("GET", `/guilds/${serverId}`, {
        status: 404,
        body: { message: "Unknown Guild" },
      });
    });

    it("returns 404 when bot is not in the server", async () => {
      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/active-threads`,
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 404);
    });
  },
);

describe(
  "GET /api/v1/discord-servers/:serverId/active-threads - User lacks permission",
  { concurrency: true },
  () => {
    const serverId = "server-threads-no-perm-202";
    const mockAccessToken = createMockAccessToken("user-202");

    before(() => {
      ctx.discordMockServer.registerRoute("GET", `/guilds/${serverId}`, {
        status: 200,
        body: { id: serverId, name: "Test Server" },
      });

      ctx.discordMockServer.registerRoute("GET", "/users/@me/guilds", {
        status: 200,
        body: [
          {
            id: serverId,
            name: "Test Server",
            owner: false,
            permissions: "0",
          },
        ],
      });
    });

    it("returns 403 when user lacks permission", async () => {
      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/active-threads`,
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 403);
    });
  },
);

describe(
  "GET /api/v1/discord-servers/:serverId/active-threads - Success",
  { concurrency: true },
  () => {
    const serverId = "server-threads-success-203";
    const mockAccessToken = createMockAccessToken("user-203");

    before(() => {
      ctx.discordMockServer.registerRoute("GET", `/guilds/${serverId}`, {
        status: 200,
        body: { id: serverId, name: "Test Server" },
      });

      ctx.discordMockServer.registerRoute("GET", "/users/@me/guilds", {
        status: 200,
        body: [
          {
            id: serverId,
            name: "Test Server",
            owner: false,
            permissions: MANAGE_CHANNEL_PERMISSION,
          },
        ],
      });

      ctx.discordMockServer.registerRoute(
        "GET",
        `/guilds/${serverId}/threads/active`,
        {
          status: 200,
          body: {
            threads: [
              {
                id: "thread-1",
                name: "Test Thread",
                guild_id: serverId,
                type: 11, // PUBLIC_THREAD
                parent_id: "channel-1",
              },
              {
                id: "thread-2",
                name: "Another Thread",
                guild_id: serverId,
                type: 11,
                parent_id: "channel-2",
              },
            ],
            members: [],
          },
        },
      );
    });

    it("returns 200 with threads list", async () => {
      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/active-threads`,
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        results: Array<{
          id: string;
          name: string;
          type: string;
        }>;
        total: number;
      };
      assert.ok(body.results);
      assert.strictEqual(body.total, 2);
      const firstResult = body.results[0];
      assert.ok(firstResult);
      assert.strictEqual(firstResult.id, "thread-1");
      assert.strictEqual(firstResult.name, "Test Thread");
      assert.strictEqual(firstResult.type, "public_thread");
    });
  },
);

describe(
  "GET /api/v1/discord-servers/:serverId/active-threads - Filter by parentChannelId",
  { concurrency: true },
  () => {
    const serverId = "server-threads-filter-204";
    const parentChannelId = "channel-1";
    const mockAccessToken = createMockAccessToken("user-204");

    before(() => {
      ctx.discordMockServer.registerRoute("GET", `/guilds/${serverId}`, {
        status: 200,
        body: { id: serverId, name: "Test Server" },
      });

      ctx.discordMockServer.registerRoute("GET", "/users/@me/guilds", {
        status: 200,
        body: [
          {
            id: serverId,
            name: "Test Server",
            owner: false,
            permissions: MANAGE_CHANNEL_PERMISSION,
          },
        ],
      });

      ctx.discordMockServer.registerRoute(
        "GET",
        `/guilds/${serverId}/threads/active`,
        {
          status: 200,
          body: {
            threads: [
              {
                id: "thread-1",
                name: "Thread in Channel 1",
                guild_id: serverId,
                type: 11,
                parent_id: parentChannelId,
              },
              {
                id: "thread-2",
                name: "Thread in Channel 2",
                guild_id: serverId,
                type: 11,
                parent_id: "channel-2",
              },
            ],
            members: [],
          },
        },
      );
    });

    it("filters threads by parentChannelId", async () => {
      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/active-threads?parentChannelId=${parentChannelId}`,
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        results: Array<{
          id: string;
          name: string;
        }>;
        total: number;
      };
      assert.strictEqual(body.total, 1);
      const firstResult = body.results[0];
      assert.ok(firstResult);
      assert.strictEqual(firstResult.id, "thread-1");
      assert.strictEqual(firstResult.name, "Thread in Channel 1");
    });
  },
);

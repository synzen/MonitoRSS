import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../helpers/test-context";
import { createMockAccessToken } from "../helpers/mock-factories";

const MANAGE_CHANNEL_PERMISSION = "16";

let ctx: AppTestContext;

before(async () => {
  ctx = await createAppTestContext();
});

after(async () => {
  await ctx.teardown();
});

describe("GET /api/v1/discord-servers/:serverId", { concurrency: true }, () => {
  it("returns 401 without authentication", async () => {
    const serverId = "server-unauth-100";
    const response = await ctx.fetch(`/api/v1/discord-servers/${serverId}`);
    assert.strictEqual(response.status, 401);
  });

  it("returns 404 when bot is not in the server", async () => {
    const serverId = "server-bot-missing-101";
    const mockAccessToken = createMockAccessToken("user-101");

    ctx.discordMockServer.registerRoute("GET", `/guilds/${serverId}`, {
      status: 404,
      body: { message: "Unknown Guild" },
    });

    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch(`/api/v1/discord-servers/${serverId}`, {
      headers: { cookie: cookies },
    });

    assert.strictEqual(response.status, 404);
  });

  it("returns 403 when user lacks permission to manage server", async () => {
    const serverId = "server-no-perm-102";
    const mockAccessToken = createMockAccessToken("user-102");

    ctx.discordMockServer.registerRoute("GET", `/guilds/${serverId}`, {
      status: 200,
      body: { id: serverId, name: "Test Server" },
    });

    ctx.discordMockServer.registerRouteForToken(
      "GET",
      "/users/@me/guilds",
      mockAccessToken.access_token,
      {
        status: 200,
        body: [
          {
            id: serverId,
            name: "Test Server",
            owner: false,
            permissions: "0",
          },
        ],
      },
    );

    const cookies = await ctx.setSession(mockAccessToken);

    const response = await ctx.fetch(`/api/v1/discord-servers/${serverId}`, {
      headers: { cookie: cookies },
    });

    assert.strictEqual(response.status, 403);
  });

  it("returns 200 with profile and includesBot when all checks pass", async () => {
    const serverId = "server-success-103";
    const mockAccessToken = createMockAccessToken("user-103");

    ctx.discordMockServer.registerRoute("GET", `/guilds/${serverId}`, {
      status: 200,
      body: { id: serverId, name: "Test Server" },
    });

    ctx.discordMockServer.registerRouteForToken(
      "GET",
      "/users/@me/guilds",
      mockAccessToken.access_token,
      {
        status: 200,
        body: [
          {
            id: serverId,
            name: "Test Server",
            owner: false,
            permissions: MANAGE_CHANNEL_PERMISSION,
          },
        ],
      },
    );

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
});

describe(
  "GET /api/v1/discord-servers/:serverId/status",
  { concurrency: true },
  () => {
    it("returns 401 without authentication", async () => {
      const serverId = "server-status-unauth-300";
      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/status`,
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 403 when user lacks permission", async () => {
      const serverId = "server-status-no-perm-301";
      const mockAccessToken = createMockAccessToken("user-301");

      ctx.discordMockServer.registerRouteForToken(
        "GET",
        "/users/@me/guilds",
        mockAccessToken.access_token,
        {
          status: 200,
          body: [
            {
              id: serverId,
              name: "Test Server",
              owner: false,
              permissions: "0",
            },
          ],
        },
      );

      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/status`,
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 403);
    });

    it("returns 200 with authorized=true when bot is in server", async () => {
      const serverId = "server-status-auth-302";
      const mockAccessToken = createMockAccessToken("user-302");

      ctx.discordMockServer.registerRoute("GET", `/guilds/${serverId}`, {
        status: 200,
        body: { id: serverId, name: "Test Server" },
      });

      ctx.discordMockServer.registerRouteForToken(
        "GET",
        "/users/@me/guilds",
        mockAccessToken.access_token,
        {
          status: 200,
          body: [
            {
              id: serverId,
              name: "Test Server",
              owner: false,
              permissions: MANAGE_CHANNEL_PERMISSION,
            },
          ],
        },
      );

      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/status`,
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { authorized: boolean };
      };
      assert.strictEqual(body.result.authorized, true);
    });

    it("returns 200 with authorized=false when bot is not in server", async () => {
      const serverId = "server-status-noauth-303";
      const mockAccessToken = createMockAccessToken("user-303");

      ctx.discordMockServer.registerRoute("GET", `/guilds/${serverId}`, {
        status: 404,
        body: { message: "Unknown Guild" },
      });

      ctx.discordMockServer.registerRouteForToken(
        "GET",
        "/users/@me/guilds",
        mockAccessToken.access_token,
        {
          status: 200,
          body: [
            {
              id: serverId,
              name: "Test Server",
              owner: false,
              permissions: MANAGE_CHANNEL_PERMISSION,
            },
          ],
        },
      );

      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/status`,
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { authorized: boolean };
      };
      assert.strictEqual(body.result.authorized, false);
    });
  },
);

describe(
  "GET /api/v1/discord-servers/:serverId/active-threads",
  { concurrency: true },
  () => {
    it("returns 401 without authentication", async () => {
      const serverId = "server-threads-unauth-200";
      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/active-threads`,
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 404 when bot is not in the server", async () => {
      const serverId = "server-threads-bot-missing-201";
      const mockAccessToken = createMockAccessToken("user-201");

      ctx.discordMockServer.registerRoute("GET", `/guilds/${serverId}`, {
        status: 404,
        body: { message: "Unknown Guild" },
      });

      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/active-threads`,
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 404);
    });

    it("returns 403 when user lacks permission", async () => {
      const serverId = "server-threads-no-perm-202";
      const mockAccessToken = createMockAccessToken("user-202");

      ctx.discordMockServer.registerRoute("GET", `/guilds/${serverId}`, {
        status: 200,
        body: { id: serverId, name: "Test Server" },
      });

      ctx.discordMockServer.registerRouteForToken(
        "GET",
        "/users/@me/guilds",
        mockAccessToken.access_token,
        {
          status: 200,
          body: [
            {
              id: serverId,
              name: "Test Server",
              owner: false,
              permissions: "0",
            },
          ],
        },
      );

      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/active-threads`,
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 403);
    });

    it("returns 200 with threads list", async () => {
      const serverId = "server-threads-success-203";
      const mockAccessToken = createMockAccessToken("user-203");

      ctx.discordMockServer.registerRoute("GET", `/guilds/${serverId}`, {
        status: 200,
        body: { id: serverId, name: "Test Server" },
      });

      ctx.discordMockServer.registerRouteForToken(
        "GET",
        "/users/@me/guilds",
        mockAccessToken.access_token,
        {
          status: 200,
          body: [
            {
              id: serverId,
              name: "Test Server",
              owner: false,
              permissions: MANAGE_CHANNEL_PERMISSION,
            },
          ],
        },
      );

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
                type: 11,
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

    it("filters threads by parentChannelId", async () => {
      const serverId = "server-threads-filter-204";
      const parentChannelId = "channel-1";
      const mockAccessToken = createMockAccessToken("user-204");

      ctx.discordMockServer.registerRoute("GET", `/guilds/${serverId}`, {
        status: 200,
        body: { id: serverId, name: "Test Server" },
      });

      ctx.discordMockServer.registerRouteForToken(
        "GET",
        "/users/@me/guilds",
        mockAccessToken.access_token,
        {
          status: 200,
          body: [
            {
              id: serverId,
              name: "Test Server",
              owner: false,
              permissions: MANAGE_CHANNEL_PERMISSION,
            },
          ],
        },
      );

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

describe(
  "GET /api/v1/discord-servers/:serverId/channels",
  { concurrency: true },
  () => {
    it("returns 401 without authentication", async () => {
      const serverId = "server-channels-unauth-400";
      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/channels`,
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 403 when user lacks permission", async () => {
      const serverId = "server-channels-no-perm-401";
      const mockAccessToken = createMockAccessToken("user-401");

      ctx.discordMockServer.registerRouteForToken(
        "GET",
        "/users/@me/guilds",
        mockAccessToken.access_token,
        {
          status: 200,
          body: [
            {
              id: serverId,
              name: "Test Server",
              owner: false,
              permissions: "0",
            },
          ],
        },
      );

      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/channels`,
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 403);
    });

    it("returns 200 with channels list", async () => {
      const serverId = "server-channels-success-402";
      const mockAccessToken = createMockAccessToken("user-402");

      ctx.discordMockServer.registerRouteForToken(
        "GET",
        "/users/@me/guilds",
        mockAccessToken.access_token,
        {
          status: 200,
          body: [
            {
              id: serverId,
              name: "Test Server",
              owner: false,
              permissions: MANAGE_CHANNEL_PERMISSION,
            },
          ],
        },
      );

      ctx.discordMockServer.registerRoute(
        "GET",
        `/guilds/${serverId}/channels`,
        {
          status: 200,
          body: [
            {
              id: "category-1",
              name: "General",
              type: 4,
              guild_id: serverId,
              position: 0,
            },
            {
              id: "channel-1",
              name: "general",
              type: 0,
              guild_id: serverId,
              parent_id: "category-1",
              position: 1,
            },
            {
              id: "channel-2",
              name: "announcements",
              type: 5,
              guild_id: serverId,
              parent_id: "category-1",
              position: 2,
            },
          ],
        },
      );

      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/channels`,
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
          category: { id: string; name: string } | null;
        }>;
        total: number;
      };
      assert.strictEqual(body.total, 2);
      const firstResult = body.results[0];
      assert.ok(firstResult);
      assert.strictEqual(firstResult.id, "channel-1");
      assert.strictEqual(firstResult.name, "general");
      assert.strictEqual(firstResult.type, "text");
      assert.ok(firstResult.category);
      assert.strictEqual(firstResult.category.id, "category-1");
      assert.strictEqual(firstResult.category.name, "General");
    });

    it("filters channels by types query parameter", async () => {
      const serverId = "server-channels-filter-403";
      const mockAccessToken = createMockAccessToken("user-403");

      ctx.discordMockServer.registerRouteForToken(
        "GET",
        "/users/@me/guilds",
        mockAccessToken.access_token,
        {
          status: 200,
          body: [
            {
              id: serverId,
              name: "Test Server",
              owner: false,
              permissions: MANAGE_CHANNEL_PERMISSION,
            },
          ],
        },
      );

      ctx.discordMockServer.registerRoute(
        "GET",
        `/guilds/${serverId}/channels`,
        {
          status: 200,
          body: [
            {
              id: "channel-1",
              name: "general",
              type: 0,
              guild_id: serverId,
              position: 0,
            },
            {
              id: "channel-2",
              name: "forum-channel",
              type: 15,
              guild_id: serverId,
              position: 1,
            },
            {
              id: "channel-3",
              name: "announcements",
              type: 5,
              guild_id: serverId,
              position: 2,
            },
          ],
        },
      );

      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/channels?types=forum`,
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
      assert.strictEqual(body.total, 1);
      const firstResult = body.results[0];
      assert.ok(firstResult);
      assert.strictEqual(firstResult.id, "channel-2");
      assert.strictEqual(firstResult.type, "forum");
    });

    it("returns 404 when server not found", async () => {
      const serverId = "server-channels-notfound-404";
      const mockAccessToken = createMockAccessToken("user-404");

      ctx.discordMockServer.registerRouteForToken(
        "GET",
        "/users/@me/guilds",
        mockAccessToken.access_token,
        {
          status: 200,
          body: [
            {
              id: serverId,
              name: "Test Server",
              owner: false,
              permissions: MANAGE_CHANNEL_PERMISSION,
            },
          ],
        },
      );

      ctx.discordMockServer.registerRoute(
        "GET",
        `/guilds/${serverId}/channels`,
        {
          status: 404,
          body: { message: "Unknown Guild" },
        },
      );

      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/channels`,
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 404);
    });
  },
);

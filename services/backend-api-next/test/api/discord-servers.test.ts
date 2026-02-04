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

describe("GET /api/v1/discord-servers/:serverId", { concurrency: true }, () => {
  it("returns 401 without authentication", async () => {
    const serverId = generateSnowflake();
    const response = await ctx.fetch(`/api/v1/discord-servers/${serverId}`);
    assert.strictEqual(response.status, 401);
  });

  it("returns 404 when bot is not in the server", async () => {
    const serverId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(generateSnowflake());

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
    const serverId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(generateSnowflake());

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
    const serverId = generateSnowflake();
    const mockAccessToken = createMockAccessToken(generateSnowflake());

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
      const serverId = generateSnowflake();
      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/status`,
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 403 when user lacks permission", async () => {
      const serverId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(generateSnowflake());

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
      const serverId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(generateSnowflake());

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
      const serverId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(generateSnowflake());

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
      const serverId = generateSnowflake();
      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/active-threads`,
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 404 when bot is not in the server", async () => {
      const serverId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(generateSnowflake());

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
      const serverId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(generateSnowflake());

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
      const serverId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(generateSnowflake());

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
      const serverId = generateSnowflake();
      const parentChannelId = "channel-1";
      const mockAccessToken = createMockAccessToken(generateSnowflake());

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
      const serverId = generateSnowflake();
      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/channels`,
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 403 when user lacks permission", async () => {
      const serverId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(generateSnowflake());

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
      const serverId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(generateSnowflake());

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
      const serverId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(generateSnowflake());

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
      const serverId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(generateSnowflake());

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

describe(
  "GET /api/v1/discord-servers/:serverId/roles",
  { concurrency: true },
  () => {
    it("returns 401 without authentication", async () => {
      const serverId = generateSnowflake();
      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/roles`,
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 404 when bot is not in the server", async () => {
      const serverId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(generateSnowflake());

      ctx.discordMockServer.registerRoute("GET", `/guilds/${serverId}`, {
        status: 404,
        body: { message: "Unknown Guild" },
      });

      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/roles`,
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 404);
    });

    it("returns 403 when user lacks permission", async () => {
      const serverId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(generateSnowflake());

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
        `/api/v1/discord-servers/${serverId}/roles`,
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 403);
    });

    it("returns 200 with roles list and hex colors", async () => {
      const serverId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(generateSnowflake());

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

      ctx.discordMockServer.registerRoute("GET", `/guilds/${serverId}/roles`, {
        status: 200,
        body: [
          {
            id: "role-1",
            name: "Admin",
            color: 16711680,
            permissions: "8",
            position: 1,
            hoist: true,
            mentionable: true,
          },
          {
            id: "role-2",
            name: "Member",
            color: 0,
            permissions: "0",
            position: 0,
            hoist: false,
            mentionable: false,
          },
        ],
      });

      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/roles`,
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        results: Array<{
          id: string;
          name: string;
          color: string;
        }>;
        total: number;
      };
      assert.strictEqual(body.total, 2);

      const adminRole = body.results[0];
      assert.ok(adminRole);
      assert.strictEqual(adminRole.id, "role-1");
      assert.strictEqual(adminRole.name, "Admin");
      assert.strictEqual(adminRole.color, "#ff0000");

      const memberRole = body.results[1];
      assert.ok(memberRole);
      assert.strictEqual(memberRole.id, "role-2");
      assert.strictEqual(memberRole.name, "Member");
      assert.strictEqual(memberRole.color, "#000000");
    });
  },
);

describe(
  "GET /api/v1/discord-servers/:serverId/members",
  { concurrency: true },
  () => {
    it("returns 401 without authentication", async () => {
      const serverId = generateSnowflake();
      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/members?search=test&limit=10`,
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 404 when bot is not in the server", async () => {
      const serverId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(generateSnowflake());

      ctx.discordMockServer.registerRoute("GET", `/guilds/${serverId}`, {
        status: 404,
        body: { message: "Unknown Guild" },
      });

      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/members?search=test&limit=10`,
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 404);
    });

    it("returns 403 when user lacks permission", async () => {
      const serverId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(generateSnowflake());

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
        `/api/v1/discord-servers/${serverId}/members?search=test&limit=10`,
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 403);
    });

    it("returns 400 when missing required search query param", async () => {
      const serverId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(generateSnowflake());

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
        `/api/v1/discord-servers/${serverId}/members?limit=10`,
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 400);
    });

    it("returns 400 when missing required limit query param", async () => {
      const serverId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(generateSnowflake());

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
        `/api/v1/discord-servers/${serverId}/members?search=test`,
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 400);
    });

    it("returns 200 with member results", async () => {
      const serverId = generateSnowflake();
      const memberId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(generateSnowflake());

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
        `/guilds/${serverId}/members/search`,
        {
          status: 200,
          body: [
            {
              roles: ["role-1"],
              nick: "Cool Nick",
              user: {
                id: memberId,
                username: "testuser",
                avatar: "a_abc123def456",
              },
            },
          ],
        },
      );

      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/members?${new URLSearchParams({ search: "test user", limit: "10" })}`,
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        results: Array<{
          id: string;
          username: string;
          displayName: string;
          avatarUrl: string | null;
        }>;
        total: number;
      };
      assert.strictEqual(body.total, 1);
      const firstResult = body.results[0];
      assert.ok(firstResult);
      assert.strictEqual(firstResult.id, memberId);
      assert.strictEqual(firstResult.username, "testuser");
      assert.strictEqual(firstResult.displayName, "Cool Nick");
      assert.strictEqual(
        firstResult.avatarUrl,
        `https://cdn.discordapp.com/avatars/${memberId}/a_abc123def456.gif`,
      );
    });

    it("returns 200 with empty results when no members match", async () => {
      const serverId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(generateSnowflake());

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
        `/guilds/${serverId}/members/search`,
        {
          status: 200,
          body: [],
        },
      );

      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/members?search=nonexistent&limit=10`,
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        results: Array<unknown>;
        total: number;
      };
      assert.strictEqual(body.total, 0);
      assert.deepStrictEqual(body.results, []);
    });
  },
);

describe(
  "GET /api/v1/discord-servers/:serverId/members/:memberId",
  { concurrency: true },
  () => {
    it("returns 401 without authentication", async () => {
      const serverId = generateSnowflake();
      const memberId = generateSnowflake();
      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/members/${memberId}`,
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 404 when bot is not in the server", async () => {
      const serverId = generateSnowflake();
      const memberId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(generateSnowflake());

      ctx.discordMockServer.registerRoute("GET", `/guilds/${serverId}`, {
        status: 404,
        body: { message: "Unknown Guild" },
      });

      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/members/${memberId}`,
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 404);
    });

    it("returns 403 when user lacks permission", async () => {
      const serverId = generateSnowflake();
      const memberId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(generateSnowflake());

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
        `/api/v1/discord-servers/${serverId}/members/${memberId}`,
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 403);
    });

    it("returns 200 with null result for invalid memberId", async () => {
      const serverId = generateSnowflake();
      const memberId = "not-a-snowflake";
      const mockAccessToken = createMockAccessToken(generateSnowflake());

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
        `/api/v1/discord-servers/${serverId}/members/${memberId}`,
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as { result: null };
      assert.strictEqual(body.result, null);
    });

    it("returns 200 with null result when member not found", async () => {
      const serverId = generateSnowflake();
      const memberId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(generateSnowflake());

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
        `/guilds/${serverId}/members/${memberId}`,
        {
          status: 404,
          body: { message: "Unknown Member" },
        },
      );

      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/members/${memberId}`,
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as { result: null };
      assert.strictEqual(body.result, null);
    });

    it("returns 200 with null result when member forbidden", async () => {
      const serverId = generateSnowflake();
      const memberId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(generateSnowflake());

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
        `/guilds/${serverId}/members/${memberId}`,
        {
          status: 403,
          body: { message: "Missing Access" },
        },
      );

      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/members/${memberId}`,
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as { result: null };
      assert.strictEqual(body.result, null);
    });

    it("returns 200 with formatted member data", async () => {
      const serverId = generateSnowflake();
      const memberId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(generateSnowflake());

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
        `/guilds/${serverId}/members/${memberId}`,
        {
          status: 200,
          body: {
            roles: ["role-1"],
            nick: "Cool Nick",
            user: {
              id: memberId,
              username: "testuser",
              avatar: "a_abc123def456",
            },
          },
        },
      );

      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/members/${memberId}`,
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: {
          id: string;
          username: string;
          displayName: string;
          avatarUrl: string;
        };
      };
      assert.ok(body.result);
      assert.strictEqual(body.result.id, memberId);
      assert.strictEqual(body.result.username, "testuser");
      assert.strictEqual(body.result.displayName, "Cool Nick");
      assert.strictEqual(
        body.result.avatarUrl,
        `https://cdn.discordapp.com/avatars/${memberId}/a_abc123def456.gif`,
      );
    });

    it("returns 200 with null avatarUrl when member has no avatar", async () => {
      const serverId = generateSnowflake();
      const memberId = generateSnowflake();
      const mockAccessToken = createMockAccessToken(generateSnowflake());

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
        `/guilds/${serverId}/members/${memberId}`,
        {
          status: 200,
          body: {
            roles: [],
            nick: null,
            user: {
              id: memberId,
              username: "noavataruser",
            },
          },
        },
      );

      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        `/api/v1/discord-servers/${serverId}/members/${memberId}`,
        {
          headers: { cookie: cookies },
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: {
          id: string;
          username: string;
          displayName: string;
          avatarUrl: string | null;
        };
      };
      assert.ok(body.result);
      assert.strictEqual(body.result.id, memberId);
      assert.strictEqual(body.result.username, "noavataruser");
      assert.strictEqual(body.result.displayName, "noavataruser");
      assert.strictEqual(body.result.avatarUrl, null);
    });
  },
);

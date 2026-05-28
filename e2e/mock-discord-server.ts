import { createServer } from "http";
import { URL } from "url";
import { MOCK_DISCORD_SERVER_PORT } from "./helpers/constants";
import {
  MOCK_DISCORD_USER,
  MOCK_DISCORD_BOT_USER,
  MOCK_DISCORD_GUILD,
  MOCK_DISCORD_CHANNELS,
  MOCK_DISCORD_ROLES,
  MOCK_DISCORD_GUILD_ID,
  MOCK_DISCORD_USER_ID,
} from "./helpers/mock-discord-data";

interface StoredWebhook {
  id: string;
  type: 1;
  guild_id: string;
  channel_id: string;
  name: string;
  avatar: string | null;
  token: string;
  application_id: string;
}

let webhookCounter = 0;
const webhooks = new Map<string, StoredWebhook>();

function generateSnowflake(): string {
  return `${Date.now()}${String(webhookCounter++).padStart(4, "0")}`;
}

function matchRoute(
  pattern: string,
  pathname: string,
): Record<string, string> | null {
  const patternParts = pattern.split("/");
  const pathParts = pathname.split("/");

  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }

  return params;
}

function jsonResponse(
  res: import("http").ServerResponse,
  status: number,
  body?: unknown,
): void {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": "50",
    "X-RateLimit-Remaining": "49",
    "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 60),
  };

  if (status !== 204) {
    headers["Content-Type"] = "application/json";
  }

  res.writeHead(status, headers);

  if (body !== undefined) {
    res.end(JSON.stringify(body));
  } else {
    res.end();
  }
}

interface Route {
  method: string;
  pattern: string;
  handler: (
    params: Record<string, string>,
    req: import("http").IncomingMessage,
    body?: unknown,
  ) => { status: number; body?: unknown };
}

function getUserFromRequest(req: import("http").IncomingMessage) {
  const auth = req.headers["authorization"] || "";
  const tokenMatch = auth.match(/^Bearer mock-token-(\d+)$/);
  if (tokenMatch) {
    return { ...MOCK_DISCORD_USER, id: tokenMatch[1] };
  }
  return MOCK_DISCORD_USER;
}

const routes: Route[] = [
  // User endpoints (Bearer token — auth service direct fetch uses /api/v9)
  {
    method: "GET",
    pattern: "/api/v9/users/@me",
    handler: (_params, req) => ({ status: 200, body: getUserFromRequest(req) }),
  },
  // User endpoints (Bearer token — @discordjs/rest uses /api/v10)
  {
    method: "GET",
    pattern: "/api/v10/users/@me",
    handler: (_params, req) => ({ status: 200, body: getUserFromRequest(req) }),
  },
  // User guilds
  {
    method: "GET",
    pattern: "/api/v10/users/@me/guilds",
    handler: () => ({
      status: 200,
      body: [
        {
          id: MOCK_DISCORD_GUILD.id,
          name: MOCK_DISCORD_GUILD.name,
          icon: MOCK_DISCORD_GUILD.icon,
          owner: MOCK_DISCORD_GUILD.owner,
          permissions: MOCK_DISCORD_GUILD.permissions,
          features: MOCK_DISCORD_GUILD.features,
        },
      ],
    }),
  },
  // Guild info (includes roles — required for permission computation)
  {
    method: "GET",
    pattern: "/api/v10/guilds/:id",
    handler: (params) => {
      if (params.id === MOCK_DISCORD_GUILD_ID) {
        return {
          status: 200,
          body: { ...MOCK_DISCORD_GUILD, roles: MOCK_DISCORD_ROLES },
        };
      }
      return { status: 404, body: { message: "Unknown Guild", code: 10004 } };
    },
  },
  // Guild channels
  {
    method: "GET",
    pattern: "/api/v10/guilds/:id/channels",
    handler: (params) => {
      if (params.id === MOCK_DISCORD_GUILD_ID) {
        return { status: 200, body: MOCK_DISCORD_CHANNELS };
      }
      return { status: 404, body: { message: "Unknown Guild", code: 10004 } };
    },
  },
  // Guild roles
  {
    method: "GET",
    pattern: "/api/v10/guilds/:id/roles",
    handler: (params) => {
      if (params.id === MOCK_DISCORD_GUILD_ID) {
        return { status: 200, body: MOCK_DISCORD_ROLES };
      }
      return { status: 404, body: { message: "Unknown Guild", code: 10004 } };
    },
  },
  // Guild emojis
  {
    method: "GET",
    pattern: "/api/v10/guilds/:id/emojis",
    handler: () => ({ status: 200, body: [] }),
  },
  // Active threads
  {
    method: "GET",
    pattern: "/api/v10/guilds/:id/threads/active",
    handler: () => ({ status: 200, body: { threads: [], members: [] } }),
  },
  // Guild member search — return mock user for any query
  {
    method: "GET",
    pattern: "/api/v10/guilds/:guildId/members/search",
    handler: () => ({
      status: 200,
      body: [
        {
          user: MOCK_DISCORD_USER,
          roles: [],
          joined_at: "2020-01-01T00:00:00.000Z",
        },
      ],
    }),
  },
  // Guild member — return success for any user (bot or human)
  {
    method: "GET",
    pattern: "/api/v10/guilds/:guildId/members/:userId",
    handler: (params) => ({
      status: 200,
      body: {
        user: {
          id: params.userId,
          username: "mock-member",
          discriminator: "0",
        },
        roles: [],
        joined_at: "2020-01-01T00:00:00.000Z",
      },
    }),
  },
  // Channel info
  {
    method: "GET",
    pattern: "/api/v10/channels/:id",
    handler: (params) => {
      const channel = MOCK_DISCORD_CHANNELS.find((c) => c.id === params.id);
      if (channel) {
        return { status: 200, body: channel };
      }
      return {
        status: 404,
        body: { message: "Unknown Channel", code: 10003 },
      };
    },
  },
  // Channel webhooks - list
  {
    method: "GET",
    pattern: "/api/v10/channels/:id/webhooks",
    handler: (params) => {
      const channelWebhooks = Array.from(webhooks.values()).filter(
        (w) => w.channel_id === params.id,
      );
      return { status: 200, body: channelWebhooks };
    },
  },
  // Channel webhooks - create
  {
    method: "POST",
    pattern: "/api/v10/channels/:id/webhooks",
    handler: (params, _req, body) => {
      const data = body as { name?: string; avatar?: string } | undefined;
      const webhook: StoredWebhook = {
        id: generateSnowflake(),
        type: 1,
        guild_id: MOCK_DISCORD_GUILD_ID,
        channel_id: params.id,
        name: data?.name || "Captain Hook",
        avatar: data?.avatar || null,
        token: `webhook-token-${Date.now()}`,
        application_id: MOCK_DISCORD_BOT_USER.id,
      };
      webhooks.set(webhook.id, webhook);
      return { status: 200, body: webhook };
    },
  },
  // Webhook - get
  {
    method: "GET",
    pattern: "/api/v10/webhooks/:id",
    handler: (params) => {
      const webhook = webhooks.get(params.id);
      if (webhook) {
        return { status: 200, body: webhook };
      }
      return {
        status: 404,
        body: { message: "Unknown Webhook", code: 10015 },
      };
    },
  },
  // Webhook - delete
  {
    method: "DELETE",
    pattern: "/api/v10/webhooks/:id",
    handler: (params) => {
      webhooks.delete(params.id);
      return { status: 204 };
    },
  },
  // Add role to guild member
  {
    method: "PUT",
    pattern: "/api/v10/guilds/:guildId/members/:userId/roles/:roleId",
    handler: () => ({ status: 200, body: {} }),
  },
  // Remove role from guild member
  {
    method: "DELETE",
    pattern: "/api/v10/guilds/:guildId/members/:userId/roles/:roleId",
    handler: () => ({ status: 200, body: {} }),
  },
  // Send message to channel
  {
    method: "POST",
    pattern: "/api/v10/channels/:id/messages",
    handler: (params) => ({
      status: 200,
      body: {
        id: generateSnowflake(),
        channel_id: params.id,
        content: "",
        author: MOCK_DISCORD_BOT_USER,
        timestamp: new Date().toISOString(),
      },
    }),
  },
  // Create thread from message
  {
    method: "POST",
    pattern: "/api/v10/channels/:channelId/messages/:messageId/threads",
    handler: (params) => ({
      status: 200,
      body: {
        id: generateSnowflake(),
        guild_id: MOCK_DISCORD_GUILD_ID,
        parent_id: params.channelId,
        name: "mock-thread",
        type: 11,
      },
    }),
  },
  // Create thread in channel
  {
    method: "POST",
    pattern: "/api/v10/channels/:id/threads",
    handler: (params) => ({
      status: 200,
      body: {
        id: generateSnowflake(),
        guild_id: MOCK_DISCORD_GUILD_ID,
        parent_id: params.id,
        name: "mock-thread",
        type: 11,
      },
    }),
  },
  // Execute webhook (send message via webhook)
  {
    method: "POST",
    pattern: "/api/v10/webhooks/:id/:token",
    handler: (params) => ({
      status: 200,
      body: {
        id: generateSnowflake(),
        channel_id: webhooks.get(params.id)?.channel_id || "unknown",
        content: "",
        author: MOCK_DISCORD_BOT_USER,
        timestamp: new Date().toISOString(),
      },
    }),
  },
  // Bot user info
  {
    method: "GET",
    pattern: "/api/v10/users/:id",
    handler: () => ({ status: 200, body: MOCK_DISCORD_BOT_USER }),
  },
  // OAuth token refresh fallback
  {
    method: "POST",
    pattern: "/api/v9/oauth2/token",
    handler: () => ({
      status: 200,
      body: {
        access_token: `refreshed-token-${MOCK_DISCORD_USER_ID}`,
        token_type: "Bearer",
        expires_in: 604800,
        refresh_token: "new-mock-refresh-token",
        scope: "identify guilds",
      },
    }),
  },
];

const server = createServer((req, res) => {
  const chunks: Buffer[] = [];

  req.on("data", (chunk: Buffer) => chunks.push(chunk));

  req.on("end", () => {
    const parsedUrl = new URL(
      req.url || "/",
      `http://localhost:${MOCK_DISCORD_SERVER_PORT}`,
    );
    const method = req.method || "GET";
    const pathname = parsedUrl.pathname;

    let body: unknown;
    const rawBody = Buffer.concat(chunks).toString();
    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        body = rawBody;
      }
    }

    for (const route of routes) {
      if (route.method !== method) continue;
      const params = matchRoute(route.pattern, pathname);
      if (params) {
        const result = route.handler(params, req, body);
        jsonResponse(res, result.status, result.body);
        return;
      }
    }

    console.error(`[mock-discord] Unmatched: ${method} ${pathname}`);
    jsonResponse(res, 404, {
      message: "Not Found (mock)",
      code: 0,
    });
  });
});

server.listen(MOCK_DISCORD_SERVER_PORT, () =>
  console.log(
    `Mock Discord server on http://localhost:${MOCK_DISCORD_SERVER_PORT}`,
  ),
);

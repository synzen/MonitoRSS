import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import mongoose, { type Connection } from "mongoose";
import { createApp } from "../../src/app";
import { createContainer, type Container } from "../../src/container";
import type { Config } from "../../src/config";
import { Environment } from "../../src/config";
import { getTestDbUri } from "./test-constants";
import type { SessionAccessToken } from "../../src/services/discord-auth/types";
import { createTestHttpServer, type TestHttpServer } from "./test-http-server";
import { createMockAccessToken } from "./mock-factories";
import type { MockApi } from "./mock-apis";

export interface AuthenticatedUser {
  accessToken: SessionAccessToken;
  fetch(path: string, options?: RequestInit): Promise<Response>;
}

async function setupDatabase(): Promise<Connection> {
  const databaseName = `test_${randomUUID().replace(/-/g, "")}`;
  const uri = getTestDbUri(databaseName);

  const connection = mongoose.createConnection(uri);
  await connection.asPromise();

  return connection;
}

export interface ServiceTestContext {
  connection: Connection;
  teardown(): Promise<void>;
}

export async function createServiceTestContext(): Promise<ServiceTestContext> {
  const connection = await setupDatabase();

  return {
    connection,
    async teardown() {
      await connection.dropDatabase();
      await connection.close();
    },
  };
}

export interface CreateSupporterData {
  id: string;
  guilds?: string[];
  expireAt?: Date;
  maxFeeds?: number;
  maxUserFeeds?: number;
  maxGuilds?: number;
  allowCustomPlaceholders?: boolean;
}

export interface AppTestContext {
  connection: Connection;
  app: FastifyInstance;
  container: Container;
  baseUrl: string;
  discordMockServer: TestHttpServer;
  mockApis: Record<string, MockApi>;
  fetch(path: string, options?: RequestInit): Promise<Response>;
  setSession(accessToken: SessionAccessToken): Promise<string>;
  asUser(discordUserId: string): Promise<AuthenticatedUser>;
  createSupporter(data: CreateSupporterData): Promise<void>;
  teardown(): Promise<void>;
}

export interface CreateAppTestContextOptions {
  configOverrides?: Partial<Config>;
  mockApis?: Record<string, MockApi>;
  beforeListen?: (app: FastifyInstance) => Promise<void> | void;
}

function createTestConfig(overrides?: Partial<Config>): Config {
  return {
    NODE_ENV: Environment.Test,
    BACKEND_API_PORT: 0,

    BACKEND_API_DISCORD_BOT_TOKEN: "test-bot-token",
    BACKEND_API_DISCORD_CLIENT_ID: "test-client-id",
    BACKEND_API_DISCORD_CLIENT_SECRET: "test-client-secret",
    BACKEND_API_DISCORD_REDIRECT_URI: "http://localhost:3000/callback",
    BACKEND_API_LOGIN_REDIRECT_URI: "http://localhost:3000",
    BACKEND_API_DISCORD_API_BASE_URL: "https://discord.com/api/v9",

    BACKEND_API_MONGODB_URI: "mongodb://localhost:27017/test",

    BACKEND_API_SESSION_SECRET: "test-secret-key-32-chars-long!!!",
    BACKEND_API_SESSION_SALT: "test-salt-16-ch!",
    BACKEND_API_SESSION_COOKIE_SECURE: false,

    BACKEND_API_RABBITMQ_BROKER_URL: "amqp://localhost:5672",

    BACKEND_API_FEED_REQUESTS_API_HOST: "http://localhost:5000",
    BACKEND_API_FEED_REQUESTS_API_KEY: "test-api-key",
    BACKEND_API_USER_FEEDS_API_HOST: "http://localhost:5001",
    BACKEND_API_USER_FEEDS_API_KEY: "test-api-key",

    BACKEND_API_FEED_USER_AGENT: "MonitoRSS-Test",

    BACKEND_API_DEFAULT_REFRESH_RATE_MINUTES: 10,
    BACKEND_API_DEFAULT_MAX_FEEDS: 5,
    BACKEND_API_DEFAULT_MAX_USER_FEEDS: 5,
    BACKEND_API_DEFAULT_DATE_FORMAT: "ddd, D MMMM YYYY, h:mm A z",
    BACKEND_API_DEFAULT_TIMEZONE: "UTC",
    BACKEND_API_DEFAULT_DATE_LANGUAGE: "en",

    BACKEND_API_SUBSCRIPTIONS_ENABLED: false,
    BACKEND_API_SUBSCRIPTIONS_HOST: undefined,
    BACKEND_API_SUBSCRIPTIONS_ACCESS_TOKEN: undefined,

    BACKEND_API_ENABLE_SUPPORTERS: false,
    BACKEND_API_DEFAULT_MAX_SUPPORTER_USER_FEEDS: 5,
    BACKEND_API_MAX_DAILY_ARTICLES_SUPPORTER: 100,
    BACKEND_API_MAX_DAILY_ARTICLES_DEFAULT: 0,
    BACKEND_API_SUPPORTER_GUILD_ID: undefined,
    BACKEND_API_SUPPORTER_ROLE_ID: undefined,
    BACKEND_API_SUPPORTER_SUBROLE_IDS: undefined,

    BACKEND_API_DATADOG_API_KEY: undefined,

    BACKEND_API_SMTP_HOST: undefined,
    BACKEND_API_SMTP_USERNAME: undefined,
    BACKEND_API_SMTP_PASSWORD: undefined,
    BACKEND_API_SMTP_FROM: undefined,

    BACKEND_API_PADDLE_KEY: undefined,
    BACKEND_API_PADDLE_URL: undefined,
    BACKEND_API_PADDLE_WEBHOOK_SECRET: undefined,

    BACKEND_API_ALLOW_LEGACY_REVERSION: false,

    BACKEND_API_SENTRY_HOST: undefined,
    BACKEND_API_SENTRY_PROJECT_IDS: [],

    BACKEND_API_ENCRYPTION_KEY_HEX: undefined,

    BACKEND_API_REDDIT_CLIENT_ID: undefined,
    BACKEND_API_REDDIT_CLIENT_SECRET: undefined,
    BACKEND_API_REDDIT_REDIRECT_URI: undefined,

    BACKEND_API_ADMIN_USER_IDS: [],

    ...overrides,
  };
}

function createMockRabbitConnection() {
  return {
    createPublisher: () => ({
      send: async () => {},
      close: async () => {},
    }),
    createConsumer: () => ({
      close: async () => {},
    }),
    close: async () => {},
    on: () => {},
  } as any;
}

export async function createAppTestContext(
  options: CreateAppTestContextOptions = {},
): Promise<AppTestContext> {
  const connection = await setupDatabase();
  const discordMockServer = createTestHttpServer({ pathPrefix: "/api/v10" });

  const mockApiOverrides: Partial<Config> = {};
  const mockApis = options.mockApis ?? {};

  for (const api of Object.values(mockApis)) {
    (mockApiOverrides as Record<string, unknown>)[api.configKey] =
      api.server.host;
  }

  const config = createTestConfig({
    BACKEND_API_DISCORD_API_BASE_URL: discordMockServer.host,
    ...mockApiOverrides,
    ...options.configOverrides,
  });

  const container = createContainer({
    config,
    mongoConnection: connection,
    rabbitmq: createMockRabbitConnection(),
  });

  const app = await createApp(container);

  app.post("/__test__/set-session", async (request, reply) => {
    const { accessToken } = request.body as { accessToken: SessionAccessToken };
    request.session.set("accessToken", accessToken);
    return reply.send({ ok: true });
  });

  if (options.beforeListen) {
    await options.beforeListen(app);
  }

  await app.listen({ port: 0 });

  const address = app.server.address();
  const port = typeof address === "object" ? address?.port : 0;
  const baseUrl = `http://localhost:${port}`;

  return {
    connection,
    app,
    container,
    baseUrl,
    discordMockServer,
    mockApis,

    async fetch(path: string, init?: RequestInit) {
      return fetch(`${baseUrl}${path}`, init);
    },

    async setSession(accessToken: SessionAccessToken) {
      const response = await fetch(`${baseUrl}/__test__/set-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
      });
      const cookie = response.headers.get("set-cookie");
      if (!cookie) {
        throw new Error("Failed to set session: no cookie returned");
      }
      return cookie;
    },

    async asUser(discordUserId: string): Promise<AuthenticatedUser> {
      const accessToken = createMockAccessToken(discordUserId);
      const sessionResponse = await fetch(`${baseUrl}/__test__/set-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
      });
      const cookies = sessionResponse.headers.get("set-cookie");
      if (!cookies) {
        throw new Error("Failed to set session: no cookie returned");
      }

      return {
        accessToken,
        async fetch(path: string, options?: RequestInit) {
          const headers = new Headers(options?.headers);
          headers.set("cookie", cookies);

          if (options?.body && !headers.has("Content-Type")) {
            headers.set("Content-Type", "application/json");
          }

          return globalThis.fetch(`${baseUrl}${path}`, {
            ...options,
            headers,
          });
        },
      };
    },

    async createSupporter(data: CreateSupporterData) {
      await container.supporterRepository.create({
        id: data.id,
        guilds: data.guilds ?? [],
        expireAt: data.expireAt,
        maxFeeds: data.maxFeeds,
        maxUserFeeds: data.maxUserFeeds,
        maxGuilds: data.maxGuilds,
        allowCustomPlaceholders: data.allowCustomPlaceholders,
        patron: false,
      });
    },

    async teardown() {
      await app.close();
      await discordMockServer.stop();
      await connection.dropDatabase();
      await connection.close();
    },
  };
}

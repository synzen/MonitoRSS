import type { FastifyInstance } from "fastify";
import type { Connection } from "mongoose";
import { createApp } from "../../src/app";
import { createContainer, type Container } from "../../src/container";
import type { Config } from "../../src/config";
import { Environment } from "../../src/config";

export interface TestContext {
  app: FastifyInstance;
  container: Container;
  baseUrl: string;

  fetch(path: string, options?: RequestInit): Promise<Response>;

  close(): Promise<void>;
}

export interface CreateTestContextOptions {
  mongoConnection: Connection;
  configOverrides?: Partial<Config>;
}

function createTestConfig(overrides?: Partial<Config>): Config {
  return {
    NODE_ENV: Environment.Test,
    BACKEND_API_PORT: 0, // Random available port

    // Discord OAuth - test values
    BACKEND_API_DISCORD_BOT_TOKEN: "test-bot-token",
    BACKEND_API_DISCORD_CLIENT_ID: "test-client-id",
    BACKEND_API_DISCORD_CLIENT_SECRET: "test-client-secret",
    BACKEND_API_DISCORD_REDIRECT_URI: "http://localhost:3000/callback",
    BACKEND_API_LOGIN_REDIRECT_URI: "http://localhost:3000",

    // MongoDB - will be overridden by actual test connection
    BACKEND_API_MONGODB_URI: "mongodb://localhost:27017/test",

    // Session - 32 char secret, 16 char salt
    BACKEND_API_SESSION_SECRET: "test-secret-key-32-chars-long!!!",
    BACKEND_API_SESSION_SALT: "test-salt-16-ch!",

    // RabbitMQ
    BACKEND_API_RABBITMQ_BROKER_URL: "amqp://localhost:5672",

    // Service APIs
    BACKEND_API_FEED_REQUESTS_API_HOST: "http://localhost:5000",
    BACKEND_API_FEED_REQUESTS_API_KEY: "test-api-key",
    BACKEND_API_USER_FEEDS_API_HOST: "http://localhost:5001",
    BACKEND_API_USER_FEEDS_API_KEY: "test-api-key",

    // Feed settings
    BACKEND_API_FEED_USER_AGENT: "MonitoRSS-Test",

    // Defaults
    BACKEND_API_DEFAULT_REFRESH_RATE_MINUTES: 10,
    BACKEND_API_DEFAULT_MAX_FEEDS: 5,
    BACKEND_API_DEFAULT_MAX_USER_FEEDS: 5,
    BACKEND_API_DEFAULT_DATE_FORMAT: "ddd, D MMMM YYYY, h:mm A z",
    BACKEND_API_DEFAULT_TIMEZONE: "UTC",
    BACKEND_API_DEFAULT_DATE_LANGUAGE: "en",

    // Subscriptions
    BACKEND_API_SUBSCRIPTIONS_ENABLED: false,
    BACKEND_API_SUBSCRIPTIONS_HOST: undefined,
    BACKEND_API_SUBSCRIPTIONS_ACCESS_TOKEN: undefined,

    // Supporters
    BACKEND_API_ENABLE_SUPPORTERS: false,
    BACKEND_API_DEFAULT_MAX_SUPPORTER_USER_FEEDS: 5,
    BACKEND_API_MAX_DAILY_ARTICLES_SUPPORTER: 100,
    BACKEND_API_MAX_DAILY_ARTICLES_DEFAULT: 0,
    BACKEND_API_SUPPORTER_GUILD_ID: undefined,
    BACKEND_API_SUPPORTER_ROLE_ID: undefined,
    BACKEND_API_SUPPORTER_SUBROLE_IDS: undefined,

    // Optional services
    BACKEND_API_DATADOG_API_KEY: undefined,

    // SMTP
    BACKEND_API_SMTP_HOST: undefined,
    BACKEND_API_SMTP_USERNAME: undefined,
    BACKEND_API_SMTP_PASSWORD: undefined,
    BACKEND_API_SMTP_FROM: undefined,

    // Paddle
    BACKEND_API_PADDLE_KEY: undefined,
    BACKEND_API_PADDLE_URL: undefined,
    BACKEND_API_PADDLE_WEBHOOK_SECRET: undefined,

    // Legacy
    BACKEND_API_ALLOW_LEGACY_REVERSION: false,

    // Sentry
    BACKEND_API_SENTRY_HOST: undefined,
    BACKEND_API_SENTRY_PROJECT_IDS: [],

    // Encryption
    BACKEND_API_ENCRYPTION_KEY_HEX: undefined,

    // Reddit
    BACKEND_API_REDDIT_CLIENT_ID: undefined,
    BACKEND_API_REDDIT_CLIENT_SECRET: undefined,
    BACKEND_API_REDDIT_REDIRECT_URI: undefined,

    // Admin
    BACKEND_API_ADMIN_USER_IDS: [],

    ...overrides,
  };
}

// Mock RabbitMQ connection for tests
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

export async function createTestContext(
  options: CreateTestContextOptions
): Promise<TestContext> {
  const config = createTestConfig(options.configOverrides);

  const container = createContainer({
    config,
    mongoConnection: options.mongoConnection,
    rabbitmq: createMockRabbitConnection(),
  });

  const app = await createApp(container);
  await app.listen({ port: 0 }); // Random port

  const address = app.server.address();
  const port = typeof address === "object" ? address?.port : 0;
  const baseUrl = `http://localhost:${port}`;

  return {
    app,
    container,
    baseUrl,

    async fetch(path: string, init?: RequestInit) {
      return fetch(`${baseUrl}${path}`, init);
    },

    async close() {
      await app.close();
    },
  };
}

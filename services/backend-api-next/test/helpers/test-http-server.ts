import http from "node:http";
import type { Config } from "../../src/config";
import { Environment } from "../../src/config";

export interface MockResponse {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface RecordedRequest {
  method: string;
  url: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

type ResponseProvider = (req: RecordedRequest) => MockResponse;

export interface TestHttpServer {
  port: number;
  host: string;
  registerRoute(
    method: string,
    path: string,
    response: MockResponse | ResponseProvider,
  ): void;
  getRequests(): RecordedRequest[];
  getRequestsForPath(path: string): RecordedRequest[];
  clear(): void;
  stop(): Promise<void>;
}

export function createTestHttpServer(): TestHttpServer {
  const requests: RecordedRequest[] = [];
  const routes = new Map<string, MockResponse | ResponseProvider>();

  function makeRouteKey(method: string, path: string): string {
    return `${method.toUpperCase()}:${path}`;
  }

  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];

    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      const bodyStr = Buffer.concat(chunks).toString();
      let body: unknown;

      try {
        body = bodyStr ? JSON.parse(bodyStr) : undefined;
      } catch {
        body = bodyStr || undefined;
      }

      const url = new URL(req.url || "/", `http://localhost`);
      const recorded: RecordedRequest = {
        method: req.method || "GET",
        url: req.url || "/",
        path: url.pathname,
        headers: req.headers as Record<string, string | string[] | undefined>,
        body,
      };

      requests.push(recorded);

      const routeKey = makeRouteKey(recorded.method, recorded.path);
      const handler = routes.get(routeKey);

      if (!handler) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Not found" }));
        return;
      }

      const mockResponse =
        typeof handler === "function" ? handler(recorded) : handler;

      res.statusCode = mockResponse.status ?? 200;
      res.setHeader("Content-Type", "application/json");

      if (mockResponse.headers) {
        for (const [key, value] of Object.entries(mockResponse.headers)) {
          res.setHeader(key, value);
        }
      }

      if (mockResponse.body !== undefined) {
        res.end(
          typeof mockResponse.body === "string"
            ? mockResponse.body
            : JSON.stringify(mockResponse.body),
        );
      } else {
        res.end();
      }
    });
  });

  server.listen(0);

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to get assigned port from server");
  }

  const assignedPort = address.port;

  return {
    port: assignedPort,
    host: `http://localhost:${assignedPort}`,

    registerRoute(
      method: string,
      path: string,
      response: MockResponse | ResponseProvider,
    ) {
      routes.set(makeRouteKey(method, path), response);
    },

    getRequests() {
      return [...requests];
    },

    getRequestsForPath(path: string) {
      return requests.filter((r) => r.path === path);
    },

    clear() {
      requests.length = 0;
      routes.clear();
    },

    stop() {
      return new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
  };
}

export interface ServiceTestContext {
  server: TestHttpServer;
  config: Config;
  close(): Promise<void>;
}

export interface CreateServiceTestContextOptions {
  configOverrides?: Partial<Config>;
}

function createTestConfig(
  serverHost: string,
  overrides?: Partial<Config>,
): Config {
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
    BACKEND_API_RABBITMQ_BROKER_URL: "amqp://localhost:5672",
    BACKEND_API_FEED_REQUESTS_API_HOST: serverHost,
    BACKEND_API_FEED_REQUESTS_API_KEY: "test-api-key",
    BACKEND_API_USER_FEEDS_API_HOST: serverHost,
    BACKEND_API_USER_FEEDS_API_KEY: "test-api-key",
    BACKEND_API_FEED_USER_AGENT: "MonitoRSS-Test",
    BACKEND_API_DEFAULT_REFRESH_RATE_MINUTES: 10,
    BACKEND_API_DEFAULT_MAX_FEEDS: 5,
    BACKEND_API_DEFAULT_MAX_USER_FEEDS: 5,
    BACKEND_API_DEFAULT_DATE_FORMAT: "ddd, D MMMM YYYY, h:mm A z",
    BACKEND_API_DEFAULT_TIMEZONE: "UTC",
    BACKEND_API_DEFAULT_DATE_LANGUAGE: "en",
    BACKEND_API_SUBSCRIPTIONS_ENABLED: true,
    BACKEND_API_SUBSCRIPTIONS_HOST: serverHost,
    BACKEND_API_SUBSCRIPTIONS_ACCESS_TOKEN: "test-access-token",
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

export function createServiceTestContext(
  options?: CreateServiceTestContextOptions,
): ServiceTestContext {
  const server = createTestHttpServer();
  const config = createTestConfig(server.host, options?.configOverrides);

  return {
    server,
    config,
    async close() {
      await server.stop();
    },
  };
}

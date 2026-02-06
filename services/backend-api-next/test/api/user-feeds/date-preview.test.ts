import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import {
  createAppTestContext,
  type AppTestContext,
} from "../../helpers/test-context";
import { createMockAccessToken } from "../../helpers/mock-factories";
import { generateSnowflake } from "../../helpers/test-id";
import {
  createTestHttpServer,
  type TestHttpServer,
} from "../../helpers/test-http-server";

let ctx: AppTestContext;
let feedApiMockServer: TestHttpServer;

before(async () => {
  feedApiMockServer = createTestHttpServer();

  ctx = await createAppTestContext({
    configOverrides: {
      BACKEND_API_USER_FEEDS_API_HOST: feedApiMockServer.host,
      BACKEND_API_FEED_REQUESTS_API_HOST: feedApiMockServer.host,
    },
  });
});

after(async () => {
  await ctx.teardown();
  await feedApiMockServer.stop();
});

beforeEach(() => {
  feedApiMockServer.clear();
});

describe(
  "POST /api/v1/user-feeds/:feedId/date-preview",
  { concurrency: true },
  () => {
    it("returns 401 without authentication", async () => {
      const response = await ctx.fetch(
        "/api/v1/user-feeds/fake-feed-id/date-preview",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      assert.strictEqual(response.status, 401);
    });

    it("returns 200 with default values", async () => {
      const mockAccessToken = createMockAccessToken(generateSnowflake());
      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        "/api/v1/user-feeds/fake-feed-id/date-preview",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({}),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { valid: boolean; output: string };
      };
      assert.strictEqual(body.result.valid, true);
      assert.ok(typeof body.result.output === "string");
      assert.ok(body.result.output.length > 0);
    });

    it("returns 200 with custom date format", async () => {
      const mockAccessToken = createMockAccessToken(generateSnowflake());
      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        "/api/v1/user-feeds/fake-feed-id/date-preview",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({ dateFormat: "YYYY-MM-DD" }),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { valid: boolean; output: string };
      };
      assert.strictEqual(body.result.valid, true);
      assert.match(body.result.output, /^\d{4}-\d{2}-\d{2}$/);
    });

    it("returns 200 with custom timezone", async () => {
      const mockAccessToken = createMockAccessToken(generateSnowflake());
      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        "/api/v1/user-feeds/fake-feed-id/date-preview",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({ dateTimezone: "America/New_York" }),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { valid: boolean; output: string };
      };
      assert.strictEqual(body.result.valid, true);
    });

    it("returns 200 with custom locale", async () => {
      const mockAccessToken = createMockAccessToken(generateSnowflake());
      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        "/api/v1/user-feeds/fake-feed-id/date-preview",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({ dateLocale: "fr" }),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { valid: boolean; output: string };
      };
      assert.strictEqual(body.result.valid, true);
    });

    it("returns 200 with valid false for invalid timezone", async () => {
      const mockAccessToken = createMockAccessToken(generateSnowflake());
      const cookies = await ctx.setSession(mockAccessToken);

      const response = await ctx.fetch(
        "/api/v1/user-feeds/fake-feed-id/date-preview",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: cookies,
          },
          body: JSON.stringify({ dateTimezone: "Invalid/Zone" }),
        },
      );

      assert.strictEqual(response.status, 200);
      const body = (await response.json()) as {
        result: { valid: boolean; output?: string };
      };
      assert.strictEqual(body.result.valid, false);
    });
  },
);

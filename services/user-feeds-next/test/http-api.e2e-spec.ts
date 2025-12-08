import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import type { Server } from "bun";
import { createHttpServer } from "../src/http";
import { inMemoryDeliveryRecordStore } from "../src/delivery-record-store";
import { createTestDiscordRestClient } from "../src/delivery";
import { getTestFeedRequestsServer } from "./setup-integration-tests";

// Must match USER_FEEDS_API_KEY in docker-compose.test.yml
const TEST_API_KEY = "test-api-key";
const TEST_PORT = 5555;

// Test feed URL - must be registered with the test feed requests server
const TEST_FEED_URL = "https://example.com/http-api-test-feed.xml";
const TEST_ARTICLE_ID = "test-article-1";

// RSS feed content with HTML for testing markdown conversion
const TEST_RSS_CONTENT = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel>
      <title>Test Feed</title>
      <item>
        <guid>${TEST_ARTICLE_ID}</guid>
        <title>&lt;b&gt;Bold Title&lt;/b&gt; and &lt;i&gt;italic&lt;/i&gt;</title>
        <description>&lt;strong&gt;Strong text&lt;/strong&gt;</description>
      </item>
    </channel>
  </rss>`;

// Type for JSON response bodies
type JsonBody = Record<string, unknown>;

let server: Server<undefined>;
let baseUrl: string;

describe("HTTP API (e2e)", () => {
  beforeAll(() => {
    // Register the test feed URL with the shared test feed requests server
    const testServer = getTestFeedRequestsServer();
    testServer.registerUrl(TEST_FEED_URL, () => ({
      body: TEST_RSS_CONTENT,
      hash: "test-hash",
    }));

    // Start the HTTP server with a test Discord client
    server = createHttpServer(
      {
        deliveryRecordStore: inMemoryDeliveryRecordStore,
        discordClient: createTestDiscordRestClient(),
      },
      TEST_PORT
    );
    baseUrl = `http://localhost:${TEST_PORT}`;
  });

  afterAll(() => {
    server.stop();
    // Clean up the registered URL
    const testServer = getTestFeedRequestsServer();
    testServer.unregisterUrl(TEST_FEED_URL);
  });

  describe("POST /v1/user-feeds/filter-validation", () => {
    const endpoint = "/v1/user-feeds/filter-validation";

    it("returns 401 without API key", async () => {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expression: {} }),
      });

      expect(response.status).toBe(401);
      const body = (await response.json()) as JsonBody;
      expect(body.message).toBe("Unauthorized");
    });

    it("returns 401 with invalid API key", async () => {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": "wrong-key",
        },
        body: JSON.stringify({ expression: {} }),
      });

      expect(response.status).toBe(401);
      const body = (await response.json()) as JsonBody;
      expect(body.message).toBe("Unauthorized");
    });

    it("validates a valid logical expression with no errors", async () => {
      const validExpression = {
        type: "LOGICAL",
        op: "AND",
        children: [
          {
            type: "RELATIONAL",
            op: "EQ",
            left: { type: "ARTICLE", value: "title" },
            right: { type: "STRING", value: "test" },
          },
        ],
      };

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({ expression: validExpression }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      const result = body.result as JsonBody;
      expect(result).toBeDefined();
      expect(result.errors).toEqual([]);
    });

    it("validates expression with OR operator", async () => {
      const validExpression = {
        type: "LOGICAL",
        op: "OR",
        children: [
          {
            type: "RELATIONAL",
            op: "CONTAINS",
            left: { type: "ARTICLE", value: "description" },
            right: { type: "STRING", value: "keyword" },
          },
          {
            type: "RELATIONAL",
            op: "MATCHES",
            left: { type: "ARTICLE", value: "title" },
            right: { type: "STRING", value: "^test.*" },
          },
        ],
      };

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({ expression: validExpression }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      const result = body.result as JsonBody;
      expect(result.errors).toEqual([]);
    });

    it("returns errors for invalid expression type", async () => {
      const invalidExpression = {
        type: "INVALID",
        op: "AND",
        children: [],
      };

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({ expression: invalidExpression }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      const result = body.result as JsonBody;
      const errors = result.errors as string[];
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("type");
      expect(errors[0]).toContain("LOGICAL");
    });

    it("returns errors for invalid operator", async () => {
      const invalidExpression = {
        type: "LOGICAL",
        op: "INVALID_OP",
        children: [],
      };

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({ expression: invalidExpression }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      const result = body.result as JsonBody;
      const errors = result.errors as string[];
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("op");
    });

    it("returns errors for missing children", async () => {
      const invalidExpression = {
        type: "LOGICAL",
        op: "AND",
        // missing children
      };

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({ expression: invalidExpression }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      const result = body.result as JsonBody;
      const errors = result.errors as string[];
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("children");
    });

    it("returns errors for invalid child expression type", async () => {
      const invalidExpression = {
        type: "LOGICAL",
        op: "AND",
        children: [
          {
            type: "UNKNOWN_TYPE",
            op: "EQ",
          },
        ],
      };

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({ expression: invalidExpression }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      const result = body.result as JsonBody;
      const errors = result.errors as string[];
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("type");
    });

    it("validates nested logical expressions", async () => {
      const nestedExpression = {
        type: "LOGICAL",
        op: "AND",
        children: [
          {
            type: "LOGICAL",
            op: "OR",
            children: [
              {
                type: "RELATIONAL",
                op: "EQ",
                left: { type: "ARTICLE", value: "title" },
                right: { type: "STRING", value: "test1" },
              },
              {
                type: "RELATIONAL",
                op: "EQ",
                left: { type: "ARTICLE", value: "title" },
                right: { type: "STRING", value: "test2" },
              },
            ],
          },
          {
            type: "RELATIONAL",
            op: "CONTAINS",
            left: { type: "ARTICLE", value: "description" },
            right: { type: "STRING", value: "keyword" },
          },
        ],
      };

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({ expression: nestedExpression }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      const result = body.result as JsonBody;
      expect(result.errors).toEqual([]);
    });

    it("returns 400 for invalid JSON body", async () => {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: "not valid json",
      });

      expect(response.status).toBe(400);
    });

    it("returns 400 for missing expression field", async () => {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /v1/user-feeds/health", () => {
    it("returns health status", async () => {
      const response = await fetch(`${baseUrl}/v1/user-feeds/health`);

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      expect(body.status).toBe("ok");
    });
  });

  describe("404 handling", () => {
    it("returns 404 for unknown routes", async () => {
      const response = await fetch(`${baseUrl}/unknown-route`);

      expect(response.status).toBe(404);
      const body = (await response.json()) as JsonBody;
      expect(body.error).toBe("Not Found");
    });
  });

  describe("POST /v1/user-feeds/test", () => {
    const endpoint = "/v1/user-feeds/test";

    it("returns 401 without API key", async () => {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(401);
      const body = (await response.json()) as JsonBody;
      expect(body.message).toBe("Unauthorized");
    });

    it("returns 401 with invalid API key", async () => {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": "wrong-key",
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(401);
      const body = (await response.json()) as JsonBody;
      expect(body.message).toBe("Unauthorized");
    });

    it("returns 400 for missing required fields", async () => {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const body = (await response.json()) as JsonBody[];
      expect(Array.isArray(body)).toBe(true);
      // Should have validation errors for missing type and feed
      expect(body.length).toBeGreaterThan(0);
    });

    it("returns 400 for invalid type", async () => {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({
          type: "invalid",
          feed: { url: "https://example.com/feed.xml" },
          mediumDetails: {},
        }),
      });

      expect(response.status).toBe(400);
      const body = (await response.json()) as JsonBody[];
      expect(Array.isArray(body)).toBe(true);
    });

    it("returns 400 for missing feed url", async () => {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({
          type: "discord",
          feed: {},
          mediumDetails: {
            content: "test",
            embeds: [],
          },
        }),
      });

      expect(response.status).toBe(400);
      const body = (await response.json()) as JsonBody[];
      expect(Array.isArray(body)).toBe(true);
    });

    it("returns 400 for missing mediumDetails", async () => {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({
          type: "discord",
          feed: { url: "https://example.com/feed.xml" },
        }),
      });

      expect(response.status).toBe(400);
      const body = (await response.json()) as JsonBody[];
      expect(Array.isArray(body)).toBe(true);
    });

    it("returns 400 for missing content in mediumDetails", async () => {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({
          type: "discord",
          feed: { url: "https://example.com/feed.xml" },
          mediumDetails: {
            embeds: [],
          },
        }),
      });

      expect(response.status).toBe(400);
      const body = (await response.json()) as JsonBody[];
      expect(Array.isArray(body)).toBe(true);
    });

    it("returns 400 for missing embeds in mediumDetails", async () => {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({
          type: "discord",
          feed: { url: "https://example.com/feed.xml" },
          mediumDetails: {
            content: "test",
          },
        }),
      });

      expect(response.status).toBe(400);
      const body = (await response.json()) as JsonBody[];
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe("POST /v1/user-feeds/preview", () => {
    const endpoint = "/v1/user-feeds/preview";

    it("formats HTML to Discord markdown in preview response", async () => {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({
          type: "discord",
          feed: { url: TEST_FEED_URL },
          article: { id: TEST_ARTICLE_ID },
          mediumDetails: {
            guildId: "test-guild-id",
            // Use rss:title__# instead of title because feedparser strips HTML from title
            content: "{{rss:title__#}}",
            embeds: [],
            components: null,
          },
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      const messages = body.messages as JsonBody[];

      expect(messages).toBeDefined();
      expect(messages.length).toBeGreaterThan(0);

      const content = messages[0]?.content as string;

      // Verify HTML was converted to Discord markdown
      expect(content).toContain("**Bold Title**");
      expect(content).toContain("*italic*");
      expect(content).not.toContain("<b>");
      expect(content).not.toContain("<i>");
      expect(content).not.toContain("&lt;");
    });
  });
});

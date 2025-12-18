import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import type { Server } from "bun";
import { randomUUID } from "crypto";
import { createHttpServer } from "../../src/http";
import { createTestDiscordRestClient } from "../../src/delivery";
import {
  getStores,
  getTestFeedRequestsServer,
} from "../helpers/setup-integration-tests";
import {
  ArticleDeliveryStatus,
  ArticleDeliveryContentType,
} from "../../src/stores/interfaces/delivery-record-store";
import {
  ArticleDiagnosisOutcome,
  DiagnosticStage,
} from "../../src/diagnostics";
import { FeedResponseRequestStatus } from "../../src/feed-fetcher";
import { createHash } from "crypto";

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

    // Get postgres-backed stores
    const stores = getStores();

    // Start the HTTP server with postgres delivery record store
    server = createHttpServer(
      {
        deliveryRecordStore: stores.deliveryRecordStore,
        discordClient: createTestDiscordRestClient(),
        feedRequestsServiceHost: stores.feedRequestsServiceHost,
        articleFieldStore: stores.articleFieldStore,
        responseHashStore: stores.responseHashStore,
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

    it("applies regex custom placeholder in preview response", async () => {
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
            content: "{{custom::extracted}}",
            embeds: [],
            components: null,
            customPlaceholders: [
              {
                id: "cp-1",
                referenceName: "extracted",
                sourcePlaceholder: "rss:title__#",
                steps: [
                  {
                    type: "REGEX",
                    regexSearch: "\\*\\*(.+?)\\*\\*",
                    replacementString: "$1",
                  },
                ],
              },
            ],
          },
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      const messages = body.messages as JsonBody[];

      expect(messages).toBeDefined();
      expect(messages.length).toBeGreaterThan(0);

      const content = messages[0]?.content as string;
      // Regex extracts "Bold Title" from "**Bold Title** and\n*italic*"
      expect(content).toBe("Bold Title and\n*italic*");
    });

    it("applies uppercase custom placeholder in preview response", async () => {
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
            content: "{{custom::upper}}",
            embeds: [],
            components: null,
            customPlaceholders: [
              {
                id: "cp-1",
                referenceName: "upper",
                sourcePlaceholder: "rss:title__#",
                steps: [{ type: "UPPERCASE" }],
              },
            ],
          },
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      const messages = body.messages as JsonBody[];

      const content = messages[0]?.content as string;
      expect(content).toBe("**BOLD TITLE** AND\n*ITALIC*");
    });

    it("applies lowercase custom placeholder in preview response", async () => {
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
            content: "{{custom::lower}}",
            embeds: [],
            components: null,
            customPlaceholders: [
              {
                id: "cp-1",
                referenceName: "lower",
                sourcePlaceholder: "rss:title__#",
                steps: [{ type: "LOWERCASE" }],
              },
            ],
          },
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      const messages = body.messages as JsonBody[];

      const content = messages[0]?.content as string;
      expect(content).toBe("**bold title** and\n*italic*");
    });

    it("applies url encode custom placeholder in preview response", async () => {
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
            content: "{{custom::encoded}}",
            embeds: [],
            components: null,
            customPlaceholders: [
              {
                id: "cp-1",
                referenceName: "encoded",
                sourcePlaceholder: "rss:title__#",
                steps: [{ type: "URL_ENCODE" }],
              },
            ],
          },
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      const messages = body.messages as JsonBody[];

      const content = messages[0]?.content as string;
      // Spaces and newlines should be encoded (asterisks are not encoded by encodeURIComponent)
      expect(content).toContain("%20");
      expect(content).toContain("%0A");
    });

    it("applies chained custom placeholder steps in preview response", async () => {
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
            content: "{{custom::chained}}",
            embeds: [],
            components: null,
            customPlaceholders: [
              {
                id: "cp-1",
                referenceName: "chained",
                sourcePlaceholder: "rss:title__#",
                steps: [
                  {
                    type: "REGEX",
                    regexSearch: "\\*\\*(.+?)\\*\\*",
                    replacementString: "$1",
                  },
                  { type: "UPPERCASE" },
                ],
              },
            ],
          },
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      const messages = body.messages as JsonBody[];

      const content = messages[0]?.content as string;
      // First regex extracts "Bold Title", then uppercase makes it "BOLD TITLE"
      expect(content).toBe("BOLD TITLE AND\n*ITALIC*");
    });

    it("returns customPlaceholderPreviews when includeCustomPlaceholderPreviews is true", async () => {
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
          includeCustomPlaceholderPreviews: true,
          mediumDetails: {
            guildId: "test-guild-id",
            content: "{{custom::preview}}",
            embeds: [],
            components: null,
            customPlaceholders: [
              {
                id: "cp-1",
                referenceName: "preview",
                sourcePlaceholder: "rss:title__#",
                steps: [
                  {
                    type: "REGEX",
                    regexSearch: "\\*\\*(.+?)\\*\\*",
                    replacementString: "$1",
                  },
                  { type: "UPPERCASE" },
                ],
              },
            ],
          },
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;

      // customPlaceholderPreviews should be present
      const previews = body.customPlaceholderPreviews as string[][];
      expect(previews).toBeDefined();
      expect(Array.isArray(previews)).toBe(true);
      expect(previews.length).toBe(1);

      // Each preview array shows: [original, after step 1, after step 2, ...]
      const placeholderPreview = previews[0] as string[];
      expect(placeholderPreview.length).toBe(3);
      expect(placeholderPreview[0]).toBe("**Bold Title** and\n*italic*"); // original
      expect(placeholderPreview[1]).toBe("Bold Title and\n*italic*"); // after regex
      expect(placeholderPreview[2]).toBe("BOLD TITLE AND\n*ITALIC*"); // after uppercase
    });

    it("returns 422 for invalid regex in custom placeholder", async () => {
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
            content: "{{custom::invalid}}",
            embeds: [],
            components: null,
            customPlaceholders: [
              {
                id: "cp-1",
                referenceName: "invalid",
                sourcePlaceholder: "rss:title__#",
                steps: [
                  {
                    type: "REGEX",
                    regexSearch: "[",
                    replacementString: "",
                  },
                ],
              },
            ],
          },
        }),
      });

      expect(response.status).toBe(422);
      const body = (await response.json()) as JsonBody;
      expect(body.code).toBe("CUSTOM_PLACEHOLDER_REGEX_EVAL");
    });
  });

  describe("POST /v1/user-feeds/validate-discord-payload", () => {
    const endpoint = "/v1/user-feeds/validate-discord-payload";

    it("returns 401 without API key", async () => {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: {} }),
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
        body: JSON.stringify({ data: {} }),
      });

      expect(response.status).toBe(401);
      const body = (await response.json()) as JsonBody;
      expect(body.message).toBe("Unauthorized");
    });

    it("returns valid=true for empty componentsV2", async () => {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({ data: { componentsV2: null } }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      expect(body.valid).toBe(true);
    });

    it("returns valid=false with errors for invalid componentsV2", async () => {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({
          data: {
            componentsV2: [{ type: "INVALID_TYPE" }],
          },
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      expect(body.valid).toBe(false);
      expect(Array.isArray(body.errors)).toBe(true);
      expect((body.errors as unknown[]).length).toBeGreaterThan(0);
    });

    it("returns valid=true for valid componentsV2 with multiple component types", async () => {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({
          data: {
            componentsV2: [
              {
                type: "SECTION",
                components: [{ type: "TEXT_DISPLAY", content: "Hello World" }],
                accessory: {
                  type: "BUTTON",
                  style: 5,
                  label: "Click me",
                  url: "https://example.com",
                },
              },
              {
                type: "ACTION_ROW",
                components: [
                  {
                    type: "BUTTON",
                    style: 1,
                    label: "Primary Button",
                  },
                ],
              },
              {
                type: "SEPARATOR",
                divider: true,
                spacing: 1,
              },
            ],
          },
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      expect(body.valid).toBe(true);
    });
  });

  describe("GET /v1/user-feeds/:feedId/delivery-count", () => {
    it("returns 400 without required timeWindowSec param", async () => {
      const feedId = randomUUID();
      const response = await fetch(
        `${baseUrl}/v1/user-feeds/${feedId}/delivery-count`,
        {
          headers: { "api-key": TEST_API_KEY },
        }
      );

      expect(response.status).toBe(400);
    });

    it("returns count=0 for feed with no deliveries", async () => {
      const feedId = randomUUID();
      const response = await fetch(
        `${baseUrl}/v1/user-feeds/${feedId}/delivery-count?timeWindowSec=3600`,
        {
          headers: { "api-key": TEST_API_KEY },
        }
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      const result = body.result as JsonBody;
      expect(result.count).toBe(0);
    });

    it("returns correct count for feed with deliveries in time window", async () => {
      const stores = getStores();
      const { deliveryRecordStore } = stores;
      const feedId = randomUUID();
      const mediumId = randomUUID();

      // Insert delivery records using the internal method that the delivery-logs test uses
      let insertResult: { inserted: number } | undefined;
      await deliveryRecordStore.startContext(async () => {
        insertResult = await deliveryRecordStore.store(feedId, [
          {
            id: randomUUID(),
            mediumId,
            articleIdHash: "count-hash1",
            article: null,
            status: ArticleDeliveryStatus.Sent,
          },
          {
            id: randomUUID(),
            mediumId,
            articleIdHash: "count-hash2",
            article: null,
            status: ArticleDeliveryStatus.Sent,
          },
        ]);
      });

      // Verify records were inserted
      expect(insertResult?.inserted).toBe(2);

      const response = await fetch(
        `${baseUrl}/v1/user-feeds/${feedId}/delivery-count?timeWindowSec=3600`,
        {
          headers: { "api-key": TEST_API_KEY },
        }
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      const result = body.result as JsonBody;
      expect(result.count).toBe(2);
    });
  });

  describe("GET /v1/user-feeds/:feedId/delivery-logs", () => {
    it("returns delivery logs with parent and child records", async () => {
      const stores = getStores();
      const { deliveryRecordStore } = stores;
      const feedId = randomUUID();
      const mediumId = randomUUID();

      // Create parent records (no parent_id) and child records (with parent_id)
      const parentId1 = randomUUID();
      const parentId2 = randomUUID();
      const childId1 = randomUUID();
      const childId2 = randomUUID();

      await deliveryRecordStore.startContext(async () => {
        // Insert parent records
        await deliveryRecordStore.store(feedId, [
          {
            id: parentId1,
            mediumId,
            articleIdHash: "hash1",
            article: null,
            status: ArticleDeliveryStatus.PendingDelivery,
            contentType: ArticleDeliveryContentType.DiscordArticleMessage,
          },
          {
            id: parentId2,
            mediumId,
            articleIdHash: "hash2",
            article: null,
            status: ArticleDeliveryStatus.PendingDelivery,
            contentType: ArticleDeliveryContentType.DiscordArticleMessage,
          },
        ]);

        // Insert child records with parent_id set
        await deliveryRecordStore.store(feedId, [
          {
            id: childId1,
            mediumId,
            articleIdHash: "hash1",
            article: null,
            status: ArticleDeliveryStatus.Sent,
            contentType: ArticleDeliveryContentType.DiscordArticleMessage,
            parent: parentId1,
          },
          {
            id: childId2,
            mediumId,
            articleIdHash: "hash2",
            article: null,
            status: ArticleDeliveryStatus.Sent,
            contentType: ArticleDeliveryContentType.DiscordArticleMessage,
            parent: parentId2,
          },
        ]);
      });

      // Call the delivery logs endpoint
      const response = await fetch(
        `${baseUrl}/v1/user-feeds/${feedId}/delivery-logs?skip=0&limit=25`,
        {
          headers: { "api-key": TEST_API_KEY },
        }
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      const result = body.result as JsonBody;
      const logs = result.logs as JsonBody[];

      expect(logs).toBeDefined();
      expect(logs.length).toBe(2);
    });

    it("returns 400 without required skip param", async () => {
      const feedId = randomUUID();
      const response = await fetch(
        `${baseUrl}/v1/user-feeds/${feedId}/delivery-logs`,
        {
          headers: { "api-key": TEST_API_KEY },
        }
      );

      expect(response.status).toBe(400);
    });
  });

  describe("POST /v1/user-feeds/get-articles", () => {
    const endpoint = "/v1/user-feeds/get-articles";

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

    it("returns articles for valid feed URL", async () => {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({
          url: TEST_FEED_URL,
          limit: 10,
          skip: 0,
          selectProperties: ["id", "title"],
          formatter: {
            options: {},
          },
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      const result = body.result as JsonBody;
      expect(result.requestStatus).toBe("SUCCESS");
      expect(Array.isArray(result.articles)).toBe(true);
      expect((result.articles as unknown[]).length).toBeGreaterThan(0);
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
    });
  });

  describe("POST /v1/user-feeds/diagnose-articles", () => {
    const endpoint = "/v1/user-feeds/diagnose-articles";

    // Test feed with multiple articles for diagnosis testing
    const DIAGNOSE_FEED_URL = "https://example.com/diagnose-test-feed.xml";
    const DIAGNOSE_ARTICLE_ID_1 = "diagnose-article-1";
    const DIAGNOSE_ARTICLE_ID_2 = "diagnose-article-2";
    const DIAGNOSE_RSS_CONTENT = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <title>Diagnose Test Feed</title>
          <item>
            <guid>${DIAGNOSE_ARTICLE_ID_1}</guid>
            <title>First Article Title</title>
            <description>First article description</description>
            <pubDate>${new Date().toUTCString()}</pubDate>
          </item>
          <item>
            <guid>${DIAGNOSE_ARTICLE_ID_2}</guid>
            <title>Second Article Title</title>
            <description>Second article description</description>
            <pubDate>${new Date().toUTCString()}</pubDate>
          </item>
        </channel>
      </rss>`;

    // Feed with an old article (7 days old) for date check testing
    const OLD_DATE_FEED_URL = "https://example.com/old-date-feed.xml";
    const OLD_DATE_ARTICLE_ID = "old-date-article";
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const OLD_DATE_RSS_CONTENT = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <title>Old Date Feed</title>
          <item>
            <guid>${OLD_DATE_ARTICLE_ID}</guid>
            <title>Old Article Title</title>
            <description>Old article description</description>
            <pubDate>${sevenDaysAgo.toUTCString()}</pubDate>
          </item>
        </channel>
      </rss>`;

    beforeAll(() => {
      const testServer = getTestFeedRequestsServer();
      testServer.registerUrl(DIAGNOSE_FEED_URL, () => ({
        body: DIAGNOSE_RSS_CONTENT,
        hash: "diagnose-test-hash",
      }));
      testServer.registerUrl(OLD_DATE_FEED_URL, () => ({
        body: OLD_DATE_RSS_CONTENT,
        hash: "old-date-test-hash",
      }));
    });

    afterAll(() => {
      const testServer = getTestFeedRequestsServer();
      testServer.unregisterUrl(DIAGNOSE_FEED_URL);
      testServer.unregisterUrl(OLD_DATE_FEED_URL);
    });

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
      expect(body.length).toBeGreaterThan(0);
    });

    it("returns 400 for missing feed.id", async () => {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({
          feed: {
            url: DIAGNOSE_FEED_URL,
            blockingComparisons: [],
            passingComparisons: [],
          },
          mediums: [],
          articleDayLimit: 10,
        }),
      });

      expect(response.status).toBe(400);
    });

    it("returns 400 for missing feed.url", async () => {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({
          feed: {
            id: randomUUID(),
            blockingComparisons: [],
            passingComparisons: [],
          },
          mediums: [],
          articleDayLimit: 10,
        }),
      });

      expect(response.status).toBe(400);
    });

    it("returns 400 for invalid limit", async () => {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({
          feed: {
            id: randomUUID(),
            url: DIAGNOSE_FEED_URL,
            blockingComparisons: [],
            passingComparisons: [],
          },
          mediums: [],
          articleDayLimit: 10,
          limit: 100, // Max is 50
        }),
      });

      expect(response.status).toBe(400);
    });

    it("returns FirstRunBaseline outcome for feed with no prior articles", async () => {
      const feedId = randomUUID();

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({
          feed: {
            id: feedId,
            url: DIAGNOSE_FEED_URL,
            blockingComparisons: [],
            passingComparisons: [],
          },
          mediums: [],
          articleDayLimit: 10,
          skip: 0,
          limit: 10,
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      expect(body.total).toBe(2); // Feed has 2 articles
      const results = body.results as JsonBody[];
      expect(results.length).toBe(2); // Should return both articles

      const result = results[0]!;
      expect(result.articleId).toBe(DIAGNOSE_ARTICLE_ID_1);
      expect(result.outcome).toBe(ArticleDiagnosisOutcome.FirstRunBaseline);
      expect(result.outcomeReason).toBeDefined();
      expect(Array.isArray(result.stages)).toBe(true);

      // Should have FeedState stage showing first run
      const stages = result.stages as JsonBody[];
      const feedStateStage = stages.find(
        (s) => s.stage === DiagnosticStage.FeedState
      );
      expect(feedStateStage).toBeDefined();
      expect(feedStateStage?.details).toBeDefined();
      const feedStateDetails = feedStateStage?.details as JsonBody;
      expect(feedStateDetails.isFirstRun).toBe(true);
    });

    it("returns DuplicateId outcome for previously seen article", async () => {
      const stores = getStores();
      const { articleFieldStore } = stores;
      const feedId = randomUUID();

      // Calculate the idHash the same way the parser does (SHA1 of article ID)
      const articleIdHash = createHash("sha1")
        .update(DIAGNOSE_ARTICLE_ID_1)
        .digest("hex");

      // Create a proper Article object to store
      const articleToStore = {
        flattened: {
          id: DIAGNOSE_ARTICLE_ID_1,
          idHash: articleIdHash,
        },
        raw: {},
      };

      // First, store the article as if it was already processed
      await articleFieldStore.startContext(async () => {
        await articleFieldStore.storeArticles(feedId, [articleToStore], []);
        await articleFieldStore.flushPendingInserts();
      });

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({
          feed: {
            id: feedId,
            url: DIAGNOSE_FEED_URL,
            blockingComparisons: [],
            passingComparisons: [],
          },
          mediums: [],
          articleDayLimit: 10,
          skip: 0,
          limit: 1, // Only get the first article
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      expect(body.total).toBe(2);
      const results = body.results as JsonBody[];
      const result = results[0]!;

      expect(result.outcome).toBe(ArticleDiagnosisOutcome.DuplicateId);
      expect(result.outcomeReason).toContain("already been seen");

      // Should have IdComparison stage showing not new
      const stages = result.stages as JsonBody[];
      const idComparisonStage = stages.find(
        (s) => s.stage === DiagnosticStage.IdComparison
      );
      expect(idComparisonStage).toBeDefined();
      expect(idComparisonStage?.passed).toBe(false);
    });

    it("returns WouldDeliver outcome for new article that passes all checks", async () => {
      const stores = getStores();
      const { articleFieldStore } = stores;
      const feedId = randomUUID();

      // Create a proper Article object for a different article so it's not a first run
      const otherArticle = {
        flattened: {
          id: "some-other-article",
          idHash: "some-other-article-hash",
        },
        raw: {},
      };

      // Store a different article so it's not a first run
      await articleFieldStore.startContext(async () => {
        await articleFieldStore.storeArticles(feedId, [otherArticle], []);
        await articleFieldStore.flushPendingInserts();
      });

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({
          feed: {
            id: feedId,
            url: DIAGNOSE_FEED_URL,
            blockingComparisons: [],
            passingComparisons: [],
          },
          mediums: [],
          articleDayLimit: 10,
          skip: 0,
          limit: 1,
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      expect(body.total).toBe(2);
      const results = body.results as JsonBody[];
      const result = results[0]!;

      expect(result.outcome).toBe(ArticleDiagnosisOutcome.WouldDeliver);
      expect(result.outcomeReason).toContain("passes all checks");
    });

    it("returns RateLimitedFeed outcome when feed daily limit exceeded", async () => {
      const stores = getStores();
      const { articleFieldStore, deliveryRecordStore } = stores;
      const feedId = randomUUID();
      const mediumId = randomUUID();

      // Store an article so it's not a first run
      const otherArticle = {
        flattened: { id: "other-article", idHash: "other-article-hash" },
        raw: {},
      };
      await articleFieldStore.startContext(async () => {
        await articleFieldStore.storeArticles(feedId, [otherArticle], []);
        await articleFieldStore.flushPendingInserts();
      });

      // Pre-fill delivery records to exceed the articleDayLimit (set to 2)
      await deliveryRecordStore.startContext(async () => {
        await deliveryRecordStore.store(feedId, [
          {
            id: randomUUID(),
            mediumId,
            articleIdHash: "rate-limit-hash-1",
            article: null,
            status: ArticleDeliveryStatus.Sent,
          },
          {
            id: randomUUID(),
            mediumId,
            articleIdHash: "rate-limit-hash-2",
            article: null,
            status: ArticleDeliveryStatus.Sent,
          },
        ]);
      });

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({
          feed: {
            id: feedId,
            url: DIAGNOSE_FEED_URL,
            blockingComparisons: [],
            passingComparisons: [],
          },
          mediums: [{ id: mediumId }],
          articleDayLimit: 2, // Already at limit
          skip: 0,
          limit: 1,
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      expect(body.total).toBe(2);
      const results = body.results as JsonBody[];
      const result = results[0]!;

      expect(result.outcome).toBe(ArticleDiagnosisOutcome.RateLimitedFeed);
      expect(result.outcomeReason).toContain("daily article delivery limit");
    });

    it("returns RateLimitedMedium outcome when medium rate limit exceeded", async () => {
      const stores = getStores();
      const { articleFieldStore, deliveryRecordStore } = stores;
      const feedId = randomUUID();
      const mediumId = randomUUID();

      // Store an article so it's not a first run
      const otherArticle = {
        flattened: { id: "other-article-2", idHash: "other-article-hash-2" },
        raw: {},
      };
      await articleFieldStore.startContext(async () => {
        await articleFieldStore.storeArticles(feedId, [otherArticle], []);
        await articleFieldStore.flushPendingInserts();
      });

      // Pre-fill delivery records for medium to exceed medium rate limit (set to 1)
      await deliveryRecordStore.startContext(async () => {
        await deliveryRecordStore.store(feedId, [
          {
            id: randomUUID(),
            mediumId,
            articleIdHash: "medium-rate-limit-hash",
            article: null,
            status: ArticleDeliveryStatus.Sent,
          },
        ]);
      });

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({
          feed: {
            id: feedId,
            url: DIAGNOSE_FEED_URL,
            blockingComparisons: [],
            passingComparisons: [],
          },
          mediums: [
            {
              id: mediumId,
              rateLimits: [{ limit: 1, timeWindowSeconds: 3600 }], // Already at limit
            },
          ],
          articleDayLimit: 100, // High enough to not hit feed limit
          skip: 0,
          limit: 1,
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      expect(body.total).toBe(2);
      const results = body.results as JsonBody[];
      const result = results[0]!;

      expect(result.outcome).toBe(ArticleDiagnosisOutcome.RateLimitedMedium);
      expect(result.outcomeReason).toContain("rate limit");
    });

    it("returns FilteredByMediumFilter outcome when medium filter blocks article", async () => {
      const stores = getStores();
      const { articleFieldStore } = stores;
      const feedId = randomUUID();
      const mediumId = randomUUID();

      // Store an article so it's not a first run
      const otherArticle = {
        flattened: { id: "other-article-3", idHash: "other-article-hash-3" },
        raw: {},
      };
      await articleFieldStore.startContext(async () => {
        await articleFieldStore.storeArticles(feedId, [otherArticle], []);
        await articleFieldStore.flushPendingInserts();
      });

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({
          feed: {
            id: feedId,
            url: DIAGNOSE_FEED_URL,
            blockingComparisons: [],
            passingComparisons: [],
          },
          mediums: [
            {
              id: mediumId,
              filters: {
                expression: {
                  type: "LOGICAL",
                  op: "AND",
                  children: [
                    {
                      type: "RELATIONAL",
                      op: "EQ",
                      left: { type: "ARTICLE", value: "title" },
                      right: { type: "STRING", value: "NonExistentTitle" }, // Won't match
                    },
                  ],
                },
              },
            },
          ],
          articleDayLimit: 100,
          skip: 0,
          limit: 1,
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      expect(body.total).toBe(2);
      const results = body.results as JsonBody[];
      const result = results[0]!;

      expect(result.outcome).toBe(ArticleDiagnosisOutcome.FilteredByMediumFilter);
      expect(result.outcomeReason).toContain("filtered out by medium");
    });

    it("returns BlockedByComparison outcome when blocking comparison field was seen", async () => {
      const stores = getStores();
      const { articleFieldStore } = stores;
      const feedId = randomUUID();

      // Hash of "First Article Title" - this is what the test article has
      const titleHash = createHash("sha1")
        .update("First Article Title")
        .digest("hex");

      // Store a prior article with a different ID but same title hash
      // This simulates a previous article that had the same title
      const priorArticle = {
        flattened: {
          id: "prior-article-with-same-title",
          idHash: "prior-article-hash",
          title: "First Article Title",
        },
        raw: {},
      };

      await articleFieldStore.startContext(async () => {
        // Store the prior article with title as comparison field
        await articleFieldStore.storeArticles(feedId, [priorArticle], ["title"]);
        // Mark "title" comparison as active
        await articleFieldStore.storeComparisonNames(feedId, ["title"]);
        await articleFieldStore.flushPendingInserts();
      });

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({
          feed: {
            id: feedId,
            url: DIAGNOSE_FEED_URL,
            blockingComparisons: ["title"], // Block on title
            passingComparisons: [],
          },
          mediums: [],
          articleDayLimit: 100,
          skip: 0,
          limit: 1, // New article ID, but same title
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      expect(body.total).toBe(2);
      const results = body.results as JsonBody[];
      const result = results[0]!;

      expect(result.outcome).toBe(ArticleDiagnosisOutcome.BlockedByComparison);
      expect(result.outcomeReason).toContain("blocked by comparison");
    });

    it("returns WouldDeliverPassingComparison outcome when passing comparison field changed", async () => {
      const stores = getStores();
      const { articleFieldStore } = stores;
      const feedId = randomUUID();

      // Calculate the idHash the same way the parser does (SHA1 of article ID)
      const articleIdHash = createHash("sha1")
        .update(DIAGNOSE_ARTICLE_ID_1)
        .digest("hex");

      // Store the article ID (so it's seen) but with a different description hash
      const priorArticle = {
        flattened: {
          id: DIAGNOSE_ARTICLE_ID_1,
          idHash: articleIdHash,
          description: "Old description that will change",
        },
        raw: {},
      };

      await articleFieldStore.startContext(async () => {
        // Store article with description as passing comparison
        await articleFieldStore.storeArticles(feedId, [priorArticle], [
          "description",
        ]);
        // Mark "description" comparison as active
        await articleFieldStore.storeComparisonNames(feedId, ["description"]);
        await articleFieldStore.flushPendingInserts();
      });

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({
          feed: {
            id: feedId,
            url: DIAGNOSE_FEED_URL,
            blockingComparisons: [],
            passingComparisons: ["description"], // Pass if description changed
          },
          mediums: [],
          articleDayLimit: 100,
          skip: 0,
          limit: 1, // Same ID, but description changed
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      expect(body.total).toBe(2);
      const results = body.results as JsonBody[];
      const result = results[0]!;

      expect(result.outcome).toBe(
        ArticleDiagnosisOutcome.WouldDeliverPassingComparison
      );
      expect(result.outcomeReason).toContain("comparison field has changed");
    });

    it("returns FilteredByDateCheck outcome when article is too old", async () => {
      const stores = getStores();
      const { articleFieldStore } = stores;
      const feedId = randomUUID();

      // Store a prior article so it's not first run
      const priorArticle = {
        flattened: { id: "prior-article", idHash: "prior-article-hash" },
        raw: {},
      };
      await articleFieldStore.startContext(async () => {
        await articleFieldStore.storeArticles(feedId, [priorArticle], []);
        await articleFieldStore.flushPendingInserts();
      });

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({
          feed: {
            id: feedId,
            url: OLD_DATE_FEED_URL, // Feed with 7-day-old article
            blockingComparisons: [],
            passingComparisons: [],
            dateChecks: {
              // 1 day threshold - article is 7 days old, should be filtered
              oldArticleDateDiffMsThreshold: 24 * 60 * 60 * 1000,
            },
          },
          mediums: [],
          articleDayLimit: 100,
          skip: 0,
          limit: 10,
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      expect(body.total).toBe(1);
      const results = body.results as JsonBody[];
      const result = results[0]!;

      expect(result.outcome).toBe(ArticleDiagnosisOutcome.FilteredByDateCheck);
      expect(result.outcomeReason).toContain("older than");
    });

    it("returns paginated results with correct total", async () => {
      const feedId = randomUUID();

      // First request - get first article only
      const response1 = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({
          feed: {
            id: feedId,
            url: DIAGNOSE_FEED_URL,
            blockingComparisons: [],
            passingComparisons: [],
          },
          mediums: [],
          articleDayLimit: 10,
          skip: 0,
          limit: 1,
        }),
      });

      expect(response1.status).toBe(200);
      const body1 = (await response1.json()) as JsonBody;
      expect(body1.total).toBe(2); // Total articles in feed
      const results1 = body1.results as JsonBody[];
      expect(results1.length).toBe(1); // Only 1 returned due to limit
      expect(results1[0]!.articleId).toBe(DIAGNOSE_ARTICLE_ID_1);

      // Second request - get second article
      const response2 = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({
          feed: {
            id: feedId,
            url: DIAGNOSE_FEED_URL,
            blockingComparisons: [],
            passingComparisons: [],
          },
          mediums: [],
          articleDayLimit: 10,
          skip: 1,
          limit: 1,
        }),
      });

      expect(response2.status).toBe(200);
      const body2 = (await response2.json()) as JsonBody;
      expect(body2.total).toBe(2);
      const results2 = body2.results as JsonBody[];
      expect(results2.length).toBe(1);
      expect(results2[0]!.articleId).toBe(DIAGNOSE_ARTICLE_ID_2);
    });

    it("returns results without stages when summaryOnly is true", async () => {
      const feedId = randomUUID();

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({
          feed: {
            id: feedId,
            url: DIAGNOSE_FEED_URL,
            blockingComparisons: [],
            passingComparisons: [],
          },
          mediums: [],
          articleDayLimit: 10,
          skip: 0,
          limit: 1,
          summaryOnly: true,
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      expect(body.total).toBe(2);
      const results = body.results as JsonBody[];

      expect(results.length).toBe(1);
      expect(results[0]!.articleId).toBe(DIAGNOSE_ARTICLE_ID_1);
      expect(results[0]!.outcome).toBeDefined();
      expect(results[0]!.stages).toBeUndefined();
    });

    it("returns FeedUnchanged outcome when feed hash matches stored hash", async () => {
      const stores = getStores();
      const { articleFieldStore, responseHashStore } = stores;
      const feedId = randomUUID();

      // Store a prior article so it's not a first run (enables hash comparison)
      const priorArticle = {
        flattened: { id: "prior-for-hash-test", idHash: "prior-hash-test" },
        raw: {},
      };
      await articleFieldStore.startContext(async () => {
        await articleFieldStore.storeArticles(feedId, [priorArticle], []);
        await articleFieldStore.flushPendingInserts();
      });

      // Store the feed's hash in responseHashStore (matching the test server's hash)
      await responseHashStore.set(feedId, "diagnose-test-hash");

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": TEST_API_KEY,
        },
        body: JSON.stringify({
          feed: {
            id: feedId,
            url: DIAGNOSE_FEED_URL,
            blockingComparisons: [],
            passingComparisons: [],
          },
          mediums: [],
          articleDayLimit: 10,
          skip: 0,
          limit: 10,
        }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as JsonBody;
      const results = body.results as JsonBody[];

      // Should return articles with FeedUnchanged outcome, not empty results
      expect(body.total).toBe(2); // Feed has 2 articles
      expect(results.length).toBe(2);

      // All articles should have FeedUnchanged outcome
      expect(results[0]!.outcome).toBe(ArticleDiagnosisOutcome.FeedUnchanged);
      expect(results[0]!.outcomeReason).toBeDefined();
      expect(results[0]!.stages).toEqual([]); // No diagnostic stages

      // Should NOT have feedState in response (removed "unchanged" as feed-level state)
      expect(body.feedState).toBeUndefined();
    });

    it("returns feedState error when feed XML is invalid", async () => {
      const testServer = getTestFeedRequestsServer();
      const INVALID_XML_FEED_URL = "https://example.com/invalid-xml-feed.xml";

      // Register a feed that returns invalid XML
      testServer.registerUrl(INVALID_XML_FEED_URL, () => ({
        body: "this is not valid XML at all <broken>",
        hash: "invalid-xml-hash",
      }));

      try {
        const stores = getStores();
        const { articleFieldStore } = stores;
        const feedId = randomUUID();

        // Store a prior article so it's not a first run
        const priorArticle = {
          flattened: { id: "prior-for-invalid-test", idHash: "prior-invalid-hash" },
          raw: {},
        };
        await articleFieldStore.startContext(async () => {
          await articleFieldStore.storeArticles(feedId, [priorArticle], []);
          await articleFieldStore.flushPendingInserts();
        });

        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": TEST_API_KEY,
          },
          body: JSON.stringify({
            feed: {
              id: feedId,
              url: INVALID_XML_FEED_URL,
              blockingComparisons: [],
              passingComparisons: [],
            },
            mediums: [],
            articleDayLimit: 10,
            skip: 0,
            limit: 10,
          }),
        });

        expect(response.status).toBe(200);
        const body = (await response.json()) as JsonBody;
        const results = body.results as JsonBody[];
        const errors = body.errors as JsonBody[];

        expect(results.length).toBe(0);
        expect(body.total).toBe(0);
        const feedState = body.feedState as JsonBody;
        expect(feedState.state).toBe("parse-error");
        expect(feedState.errorType).toBe("invalid");
        expect(errors.length).toBe(1);
        expect(errors[0]!.message).toContain("parse error");
      } finally {
        testServer.unregisterUrl(INVALID_XML_FEED_URL);
      }
    });

    it("returns feedState fetch-error with timeout when feed request times out", async () => {
      const testServer = getTestFeedRequestsServer();
      const TIMEOUT_FEED_URL = "https://example.com/timeout-feed.xml";

      testServer.registerUrl(TIMEOUT_FEED_URL, () => ({
        requestStatus: FeedResponseRequestStatus.FetchTimeout,
      }));

      try {
        const feedId = randomUUID();

        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": TEST_API_KEY,
          },
          body: JSON.stringify({
            feed: {
              id: feedId,
              url: TIMEOUT_FEED_URL,
              blockingComparisons: [],
              passingComparisons: [],
            },
            mediums: [],
            articleDayLimit: 10,
            skip: 0,
            limit: 10,
          }),
        });

        expect(response.status).toBe(200);
        const body = (await response.json()) as JsonBody;
        const results = body.results as JsonBody[];
        const errors = body.errors as JsonBody[];

        expect(results.length).toBe(0);
        expect(body.total).toBe(0);
        const feedState = body.feedState as JsonBody;
        expect(feedState.state).toBe("fetch-error");
        expect(feedState.errorType).toBe("timeout");
        expect(errors.length).toBe(1);
        expect(errors[0]!.message).toContain("timeout");
      } finally {
        testServer.unregisterUrl(TIMEOUT_FEED_URL);
      }
    });

    it("returns feedState fetch-error with bad-status-code and httpStatusCode when feed returns non-200", async () => {
      const testServer = getTestFeedRequestsServer();
      const BAD_STATUS_FEED_URL = "https://example.com/bad-status-feed.xml";

      testServer.registerUrl(BAD_STATUS_FEED_URL, () => ({
        requestStatus: FeedResponseRequestStatus.BadStatusCode,
        statusCode: 503,
      }));

      try {
        const feedId = randomUUID();

        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": TEST_API_KEY,
          },
          body: JSON.stringify({
            feed: {
              id: feedId,
              url: BAD_STATUS_FEED_URL,
              blockingComparisons: [],
              passingComparisons: [],
            },
            mediums: [],
            articleDayLimit: 10,
            skip: 0,
            limit: 10,
          }),
        });

        expect(response.status).toBe(200);
        const body = (await response.json()) as JsonBody;
        const results = body.results as JsonBody[];
        const errors = body.errors as JsonBody[];

        expect(results.length).toBe(0);
        expect(body.total).toBe(0);
        const feedState = body.feedState as JsonBody;
        expect(feedState.state).toBe("fetch-error");
        expect(feedState.errorType).toBe("bad-status-code");
        expect(feedState.httpStatusCode).toBe(503);
        expect(errors.length).toBe(1);
        expect(errors[0]!.message).toContain("bad-status-code");
      } finally {
        testServer.unregisterUrl(BAD_STATUS_FEED_URL);
      }
    });

    it("returns feedState fetch-error with fetch when network error occurs", async () => {
      const testServer = getTestFeedRequestsServer();
      const FETCH_ERROR_FEED_URL = "https://example.com/fetch-error-feed.xml";

      testServer.registerUrl(FETCH_ERROR_FEED_URL, () => ({
        requestStatus: FeedResponseRequestStatus.FetchError,
      }));

      try {
        const feedId = randomUUID();

        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": TEST_API_KEY,
          },
          body: JSON.stringify({
            feed: {
              id: feedId,
              url: FETCH_ERROR_FEED_URL,
              blockingComparisons: [],
              passingComparisons: [],
            },
            mediums: [],
            articleDayLimit: 10,
            skip: 0,
            limit: 10,
          }),
        });

        expect(response.status).toBe(200);
        const body = (await response.json()) as JsonBody;
        const results = body.results as JsonBody[];
        const errors = body.errors as JsonBody[];

        expect(results.length).toBe(0);
        expect(body.total).toBe(0);
        const feedState = body.feedState as JsonBody;
        expect(feedState.state).toBe("fetch-error");
        expect(feedState.errorType).toBe("fetch");
        expect(errors.length).toBe(1);
        expect(errors[0]!.message).toContain("fetch");
      } finally {
        testServer.unregisterUrl(FETCH_ERROR_FEED_URL);
      }
    });

    it("returns feedState fetch-error with internal when service has internal error", async () => {
      const testServer = getTestFeedRequestsServer();
      const INTERNAL_ERROR_FEED_URL =
        "https://example.com/internal-error-feed.xml";

      testServer.registerUrl(INTERNAL_ERROR_FEED_URL, () => ({
        requestStatus: FeedResponseRequestStatus.InternalError,
      }));

      try {
        const feedId = randomUUID();

        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": TEST_API_KEY,
          },
          body: JSON.stringify({
            feed: {
              id: feedId,
              url: INTERNAL_ERROR_FEED_URL,
              blockingComparisons: [],
              passingComparisons: [],
            },
            mediums: [],
            articleDayLimit: 10,
            skip: 0,
            limit: 10,
          }),
        });

        expect(response.status).toBe(200);
        const body = (await response.json()) as JsonBody;
        const results = body.results as JsonBody[];
        const errors = body.errors as JsonBody[];

        expect(results.length).toBe(0);
        expect(body.total).toBe(0);
        const feedState = body.feedState as JsonBody;
        expect(feedState.state).toBe("fetch-error");
        expect(feedState.errorType).toBe("internal");
        expect(errors.length).toBe(1);
        expect(errors[0]!.message).toContain("internal");
      } finally {
        testServer.unregisterUrl(INTERNAL_ERROR_FEED_URL);
      }
    });

    it("returns feedState fetch-error with parse when feed-requests cannot parse response", async () => {
      const testServer = getTestFeedRequestsServer();
      const PARSE_ERROR_FEED_URL = "https://example.com/parse-error-feed.xml";

      testServer.registerUrl(PARSE_ERROR_FEED_URL, () => ({
        requestStatus: FeedResponseRequestStatus.ParseError,
      }));

      try {
        const feedId = randomUUID();

        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": TEST_API_KEY,
          },
          body: JSON.stringify({
            feed: {
              id: feedId,
              url: PARSE_ERROR_FEED_URL,
              blockingComparisons: [],
              passingComparisons: [],
            },
            mediums: [],
            articleDayLimit: 10,
            skip: 0,
            limit: 10,
          }),
        });

        expect(response.status).toBe(200);
        const body = (await response.json()) as JsonBody;
        const results = body.results as JsonBody[];
        const errors = body.errors as JsonBody[];

        expect(results.length).toBe(0);
        expect(body.total).toBe(0);
        const feedState = body.feedState as JsonBody;
        expect(feedState.state).toBe("fetch-error");
        expect(feedState.errorType).toBe("parse");
        expect(errors.length).toBe(1);
        expect(errors[0]!.message).toContain("parse");
      } finally {
        testServer.unregisterUrl(PARSE_ERROR_FEED_URL);
      }
    });
  });
});

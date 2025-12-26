import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { randomUUID } from "crypto";
import { ArticleDeliveryStatus } from "../../src/delivery";
import { CustomPlaceholderStepType } from "../../src/shared/constants";
import getTestRssFeed from "../data/test-rss-feed";
import { createTestContext } from "../helpers/test-context";
import { setupTestDatabase, teardownTestDatabase, type TestStores, getTestFeedRequestsServer } from "../helpers/setup-integration-tests";
import type { FeedV2Event } from "../../src/shared/schemas";

let stores: TestStores;

type MediumDetails = FeedV2Event["data"]["mediums"][0]["details"];

/**
 * Helper to create a feed event with external properties and custom content template.
 */
function createEventWithExternalProperties(
  baseEvent: FeedV2Event,
  options: {
    externalProperties: Array<{
      sourceField: string;
      label: string;
      cssSelector: string;
    }>;
    content?: string;
    customPlaceholders?: MediumDetails["customPlaceholders"];
  }
): FeedV2Event {
  return {
    ...baseEvent,
    data: {
      ...baseEvent.data,
      feed: {
        ...baseEvent.data.feed,
        externalProperties: options.externalProperties,
      },
      mediums: [
        {
          ...baseEvent.data.mediums[0]!,
          details: {
            ...baseEvent.data.mediums[0]!.details,
            content:
              options.content ?? baseEvent.data.mediums[0]!.details.content,
            customPlaceholders:
              options.customPlaceholders ??
              baseEvent.data.mediums[0]!.details.customPlaceholders,
          },
        },
      ],
    },
  };
}

/**
 * Helper to extract the Discord payload from captured requests
 */
function getDiscordPayload(ctx: ReturnType<typeof createTestContext>) {
  assert.ok(ctx.discordClient.capturedPayloads.length > 0);
  return JSON.parse(
    ctx.discordClient.capturedPayloads[0]!.options.body as string
  );
}

describe("External Properties (e2e)", { concurrency: true }, () => {
  before(async () => {
    stores = await setupTestDatabase();
  });

  after(async () => {
    await teardownTestDatabase();
  });

  describe("Basic External Property Tests", () => {
    it("injects external content from article link", async () => {
      const ctx = createTestContext(stores);
      const testServer = getTestFeedRequestsServer();
      const articleLink = `https://example.com/article-${randomUUID()}`;

      const eventWithExternal = createEventWithExternalProperties(
        ctx.testFeedV2Event,
        {
          externalProperties: [
            { sourceField: "link", label: "content", cssSelector: ".article" },
          ],
          content: "{{external::link::content0}}",
        }
      );

      try {
        // Register external URL response
        testServer.registerUrl(articleLink, () => ({
          body: `<html><body><div class="article">Extracted Article Content</div></body></html>`,
        }));

        // Seed initial articles
        await ctx.seedArticles(eventWithExternal);

        // Update feed to return new article with the link
        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "external-test", title: "Test", link: articleLink }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithExternal);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);
        assert.strictEqual(results![0]!.status, ArticleDeliveryStatus.PendingDelivery);

        const payload = getDiscordPayload(ctx);
        // HTML is converted to markdown, so just the text content remains
        assert.strictEqual(payload.content, "Extracted Article Content");
      } finally {
        testServer.unregisterUrl(articleLink);
        ctx.cleanup();
      }
    });

    it("extracts multiple CSS matches with indexes", async () => {
      const ctx = createTestContext(stores);
      const testServer = getTestFeedRequestsServer();
      const articleLink = `https://example.com/article-${randomUUID()}`;

      const eventWithExternal = createEventWithExternalProperties(
        ctx.testFeedV2Event,
        {
          externalProperties: [
            { sourceField: "link", label: "item", cssSelector: ".item" },
          ],
          content:
            "Items: {{external::link::item0}} | {{external::link::item1}} | {{external::link::item2}}",
        }
      );

      try {
        testServer.registerUrl(articleLink, () => ({
          body: `<html><body>
            <div class="item">First Item</div>
            <div class="item">Second Item</div>
            <div class="item">Third Item</div>
          </body></html>`,
        }));

        await ctx.seedArticles(eventWithExternal);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "multi-match", title: "Test", link: articleLink }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithExternal);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);
        assert.strictEqual(payload.content,
          "Items: First Item | Second Item | Third Item"
        );
      } finally {
        testServer.unregisterUrl(articleLink);
        ctx.cleanup();
      }
    });

    it("extracts images from injected content", async () => {
      const ctx = createTestContext(stores);
      const testServer = getTestFeedRequestsServer();
      const articleLink = `https://example.com/article-${randomUUID()}`;

      const eventWithExternal = createEventWithExternalProperties(
        ctx.testFeedV2Event,
        {
          externalProperties: [
            { sourceField: "link", label: "content", cssSelector: ".content" },
          ],
          content: "Image URL: {{external::link::content0::image0}}",
        }
      );

      try {
        testServer.registerUrl(articleLink, () => ({
          body: `<html><body>
            <div class="content">
              <img src="https://example.com/image.jpg" alt="Test Image" />
              <p>Some text</p>
            </div>
          </body></html>`,
        }));

        await ctx.seedArticles(eventWithExternal);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "image-test", title: "Test", link: articleLink }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithExternal);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);
        assert.strictEqual(payload.content,
          "Image URL: https://example.com/image.jpg"
        );
      } finally {
        testServer.unregisterUrl(articleLink);
        ctx.cleanup();
      }
    });

    it("extracts anchors from injected content", async () => {
      const ctx = createTestContext(stores);
      const testServer = getTestFeedRequestsServer();
      const articleLink = `https://example.com/article-${randomUUID()}`;

      const eventWithExternal = createEventWithExternalProperties(
        ctx.testFeedV2Event,
        {
          externalProperties: [
            { sourceField: "link", label: "content", cssSelector: ".content" },
          ],
          content: "Link URL: {{external::link::content0::anchor0}}",
        }
      );

      try {
        testServer.registerUrl(articleLink, () => ({
          body: `<html><body>
            <div class="content">
              <a href="https://example.com/related-article">Read more</a>
            </div>
          </body></html>`,
        }));

        await ctx.seedArticles(eventWithExternal);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "anchor-test", title: "Test", link: articleLink }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithExternal);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);
        assert.strictEqual(payload.content,
          "Link URL: https://example.com/related-article"
        );
      } finally {
        testServer.unregisterUrl(articleLink);
        ctx.cleanup();
      }
    });
  });

  describe("Multiple External Properties", () => {
    it("handles multiple properties with same source field (cached)", async () => {
      const ctx = createTestContext(stores);
      const testServer = getTestFeedRequestsServer();
      const articleLink = `https://example.com/article-${randomUUID()}`;

      const eventWithExternal = createEventWithExternalProperties(
        ctx.testFeedV2Event,
        {
          externalProperties: [
            { sourceField: "link", label: "title", cssSelector: ".title" },
            { sourceField: "link", label: "body", cssSelector: ".body" },
          ],
          content:
            "Title: {{external::link::title0}} | Body: {{external::link::body0}}",
        }
      );

      try {
        testServer.registerUrl(articleLink, () => ({
          body: `<html><body>
            <div class="title">Article Title</div>
            <div class="body">Article Body Content</div>
          </body></html>`,
        }));

        await ctx.seedArticles(eventWithExternal);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "multi-prop", title: "Test", link: articleLink }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithExternal);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);
        assert.strictEqual(payload.content,
          "Title: Article Title | Body: Article Body Content"
        );
      } finally {
        testServer.unregisterUrl(articleLink);
        ctx.cleanup();
      }
    });

    it("handles multiple properties with different source fields", async () => {
      const ctx = createTestContext(stores);
      const testServer = getTestFeedRequestsServer();
      const articleLink = `https://example.com/article-${randomUUID()}`;
      const commentsUrl = `https://example.com/comments-${randomUUID()}`;

      const eventWithExternal = createEventWithExternalProperties(
        ctx.testFeedV2Event,
        {
          externalProperties: [
            { sourceField: "link", label: "main", cssSelector: ".main" },
            {
              sourceField: "comments",
              label: "discuss",
              cssSelector: ".comments-info",
            },
          ],
          content:
            "Main: {{external::link::main0}} | Comments: {{external::comments::discuss0}}",
        }
      );

      try {
        testServer.registerUrl(articleLink, () => ({
          body: `<html><body><div class="main">Main Content</div></body></html>`,
        }));

        testServer.registerUrl(commentsUrl, () => ({
          body: `<html><body><div class="comments-info">Discussion Thread</div></body></html>`,
        }));

        await ctx.seedArticles(eventWithExternal);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "multi-source",
                title: "Test",
                link: articleLink,
                comments: commentsUrl,
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithExternal);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);
        assert.strictEqual(payload.content,
          "Main: Main Content | Comments: Discussion Thread"
        );
      } finally {
        testServer.unregisterUrl(articleLink);
        testServer.unregisterUrl(commentsUrl);
        ctx.cleanup();
      }
    });

    it("all indexed placeholders are available in output", async () => {
      const ctx = createTestContext(stores);
      const testServer = getTestFeedRequestsServer();
      const articleLink = `https://example.com/article-${randomUUID()}`;

      const eventWithExternal = createEventWithExternalProperties(
        ctx.testFeedV2Event,
        {
          externalProperties: [
            { sourceField: "link", label: "para", cssSelector: "p" },
          ],
          content:
            "P0: {{external::link::para0}} | P1: {{external::link::para1}} | P2: {{external::link::para2}} | P3: {{external::link::para3}}",
        }
      );

      try {
        testServer.registerUrl(articleLink, () => ({
          body: `<html><body>
            <p>Paragraph One</p>
            <p>Paragraph Two</p>
            <p>Paragraph Three</p>
            <p>Paragraph Four</p>
          </body></html>`,
        }));

        await ctx.seedArticles(eventWithExternal);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "indexed", title: "Test", link: articleLink }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithExternal);

        assert.notStrictEqual(results, null);

        const payload = getDiscordPayload(ctx);
        assert.strictEqual(payload.content,
          "P0: Paragraph One | P1: Paragraph Two | P2: Paragraph Three | P3: Paragraph Four"
        );
      } finally {
        testServer.unregisterUrl(articleLink);
        ctx.cleanup();
      }
    });
  });

  describe("CSS Selector Tests", () => {
    it("supports ID selector (#id)", async () => {
      const ctx = createTestContext(stores);
      const testServer = getTestFeedRequestsServer();
      const articleLink = `https://example.com/article-${randomUUID()}`;

      const eventWithExternal = createEventWithExternalProperties(
        ctx.testFeedV2Event,
        {
          externalProperties: [
            {
              sourceField: "link",
              label: "main",
              cssSelector: "#main-content",
            },
          ],
          content: "{{external::link::main0}}",
        }
      );

      try {
        testServer.registerUrl(articleLink, () => ({
          body: `<html><body>
            <div id="sidebar">Sidebar</div>
            <div id="main-content">Main Content Here</div>
          </body></html>`,
        }));

        await ctx.seedArticles(eventWithExternal);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "id-selector", title: "Test", link: articleLink }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithExternal);

        assert.notStrictEqual(results, null);

        const payload = getDiscordPayload(ctx);
        assert.strictEqual(payload.content, "Main Content Here");
      } finally {
        testServer.unregisterUrl(articleLink);
        ctx.cleanup();
      }
    });

    it("supports class selector (.class)", async () => {
      const ctx = createTestContext(stores);
      const testServer = getTestFeedRequestsServer();
      const articleLink = `https://example.com/article-${randomUUID()}`;

      const eventWithExternal = createEventWithExternalProperties(
        ctx.testFeedV2Event,
        {
          externalProperties: [
            {
              sourceField: "link",
              label: "body",
              cssSelector: ".article-body",
            },
          ],
          content: "{{external::link::body0}}",
        }
      );

      try {
        testServer.registerUrl(articleLink, () => ({
          body: `<html><body>
            <div class="article-header">Header</div>
            <div class="article-body">Body Content</div>
          </body></html>`,
        }));

        await ctx.seedArticles(eventWithExternal);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "class-selector", title: "Test", link: articleLink }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithExternal);

        assert.notStrictEqual(results, null);

        const payload = getDiscordPayload(ctx);
        assert.strictEqual(payload.content, "Body Content");
      } finally {
        testServer.unregisterUrl(articleLink);
        ctx.cleanup();
      }
    });

    it("supports nested selectors (div.content p)", async () => {
      const ctx = createTestContext(stores);
      const testServer = getTestFeedRequestsServer();
      const articleLink = `https://example.com/article-${randomUUID()}`;

      const eventWithExternal = createEventWithExternalProperties(
        ctx.testFeedV2Event,
        {
          externalProperties: [
            {
              sourceField: "link",
              label: "para",
              cssSelector: "div.content p",
            },
          ],
          content: "{{external::link::para0}}",
        }
      );

      try {
        testServer.registerUrl(articleLink, () => ({
          body: `<html><body>
            <p>Outer paragraph</p>
            <div class="content">
              <p>Inner paragraph in content</p>
            </div>
          </body></html>`,
        }));

        await ctx.seedArticles(eventWithExternal);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "nested-selector", title: "Test", link: articleLink }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithExternal);

        assert.notStrictEqual(results, null);

        const payload = getDiscordPayload(ctx);
        assert.strictEqual(payload.content, "Inner paragraph in content");
      } finally {
        testServer.unregisterUrl(articleLink);
        ctx.cleanup();
      }
    });

    it("supports attribute selector ([data-content])", async () => {
      const ctx = createTestContext(stores);
      const testServer = getTestFeedRequestsServer();
      const articleLink = `https://example.com/article-${randomUUID()}`;

      const eventWithExternal = createEventWithExternalProperties(
        ctx.testFeedV2Event,
        {
          externalProperties: [
            {
              sourceField: "link",
              label: "data",
              cssSelector: "[data-content='main']",
            },
          ],
          content: "{{external::link::data0}}",
        }
      );

      try {
        testServer.registerUrl(articleLink, () => ({
          body: `<html><body>
            <div data-content="sidebar">Sidebar Content</div>
            <div data-content="main">Main Data Content</div>
          </body></html>`,
        }));

        await ctx.seedArticles(eventWithExternal);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "attr-selector", title: "Test", link: articleLink }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithExternal);

        assert.notStrictEqual(results, null);

        const payload = getDiscordPayload(ctx);
        assert.strictEqual(payload.content, "Main Data Content");
      } finally {
        testServer.unregisterUrl(articleLink);
        ctx.cleanup();
      }
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("handles missing source field in article gracefully", async () => {
      const ctx = createTestContext(stores);

      const eventWithExternal = createEventWithExternalProperties(
        ctx.testFeedV2Event,
        {
          externalProperties: [
            { sourceField: "link", label: "content", cssSelector: ".article" },
          ],
          // Fallback to title when external placeholder is empty
          content: "Title: {{title}}",
        }
      );

      try {
        await ctx.seedArticles(eventWithExternal);

        // Article without a link field
        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "no-link", title: "Article Without Link" }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithExternal);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);
        assert.strictEqual(results![0]!.status, ArticleDeliveryStatus.PendingDelivery);

        const payload = getDiscordPayload(ctx);
        assert.strictEqual(payload.content, "Title: Article Without Link");
      } finally {
        ctx.cleanup();
      }
    });

    it("handles external fetch failure gracefully", async () => {
      const ctx = createTestContext(stores);
      const testServer = getTestFeedRequestsServer();
      const articleLink = `https://example.com/failing-${randomUUID()}`;

      const eventWithExternal = createEventWithExternalProperties(
        ctx.testFeedV2Event,
        {
          externalProperties: [
            { sourceField: "link", label: "content", cssSelector: ".article" },
          ],
          // Should fall back to empty when external fails
          content: "Content: [{{external::link::content0}}] End",
        }
      );

      try {
        // Don't register the URL, so fetch will return default empty response

        await ctx.seedArticles(eventWithExternal);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "fetch-fail", title: "Test", link: articleLink }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithExternal);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);
        // External placeholder should be empty when fetch fails
        assert.strictEqual(payload.content, "Content: [] End");
      } finally {
        ctx.cleanup();
      }
    });

    it("handles CSS selector that matches nothing", async () => {
      const ctx = createTestContext(stores);
      const testServer = getTestFeedRequestsServer();
      const articleLink = `https://example.com/article-${randomUUID()}`;

      const eventWithExternal = createEventWithExternalProperties(
        ctx.testFeedV2Event,
        {
          externalProperties: [
            {
              sourceField: "link",
              label: "content",
              cssSelector: ".nonexistent-class",
            },
          ],
          content: "Content: [{{external::link::content0}}] End",
        }
      );

      try {
        testServer.registerUrl(articleLink, () => ({
          body: `<html><body><div class="article">Real Content</div></body></html>`,
        }));

        await ctx.seedArticles(eventWithExternal);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "no-match", title: "Test", link: articleLink }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithExternal);

        assert.notStrictEqual(results, null);

        const payload = getDiscordPayload(ctx);
        // Placeholder should be empty when selector matches nothing
        assert.strictEqual(payload.content, "Content: [] End");
      } finally {
        testServer.unregisterUrl(articleLink);
        ctx.cleanup();
      }
    });

    it("limits to maximum 10 matches per selector", async () => {
      const ctx = createTestContext(stores);
      const testServer = getTestFeedRequestsServer();
      const articleLink = `https://example.com/article-${randomUUID()}`;

      const eventWithExternal = createEventWithExternalProperties(
        ctx.testFeedV2Event,
        {
          externalProperties: [
            { sourceField: "link", label: "item", cssSelector: ".item" },
          ],
          // Try to access item9 (10th) and item10 (11th - should be empty)
          content:
            "Item9: [{{external::link::item9}}] | Item10: [{{external::link::item10}}]",
        }
      );

      try {
        // Generate 15 items
        const items = Array.from(
          { length: 15 },
          (_, i) => `<div class="item">Item ${i}</div>`
        );

        testServer.registerUrl(articleLink, () => ({
          body: `<html><body>${items.join("")}</body></html>`,
        }));

        await ctx.seedArticles(eventWithExternal);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "limit-test", title: "Test", link: articleLink }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithExternal);

        assert.notStrictEqual(results, null);

        const payload = getDiscordPayload(ctx);
        // item9 should exist (10th item), item10 should be empty (11th - beyond limit)
        assert.strictEqual(payload.content, "Item9: [Item 9] | Item10: []");
      } finally {
        testServer.unregisterUrl(articleLink);
        ctx.cleanup();
      }
    });
  });

  describe("Integration with Other Features", () => {
    it("works with custom placeholders to transform external content", async () => {
      const ctx = createTestContext(stores);
      const testServer = getTestFeedRequestsServer();
      const articleLink = `https://example.com/article-${randomUUID()}`;

      const eventWithExternal = createEventWithExternalProperties(
        ctx.testFeedV2Event,
        {
          externalProperties: [
            { sourceField: "link", label: "content", cssSelector: ".title" },
          ],
          content: "{{custom::upperTitle}}",
          customPlaceholders: [
            {
              id: "1",
              referenceName: "upperTitle",
              sourcePlaceholder: "external::link::content0",
              steps: [{ type: CustomPlaceholderStepType.Uppercase }],
            },
          ],
        }
      );

      try {
        testServer.registerUrl(articleLink, () => ({
          body: `<html><body><div class="title">lowercase title</div></body></html>`,
        }));

        await ctx.seedArticles(eventWithExternal);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "custom-combo", title: "Test", link: articleLink }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithExternal);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);
        assert.strictEqual(payload.content, "LOWERCASE TITLE");
      } finally {
        testServer.unregisterUrl(articleLink);
        ctx.cleanup();
      }
    });

    it("applies regex custom placeholder to external content", async () => {
      const ctx = createTestContext(stores);
      const testServer = getTestFeedRequestsServer();
      const articleLink = `https://example.com/article-${randomUUID()}`;

      const eventWithExternal = createEventWithExternalProperties(
        ctx.testFeedV2Event,
        {
          externalProperties: [
            { sourceField: "link", label: "price", cssSelector: ".price" },
          ],
          content: "Price: {{custom::cleanPrice}}",
          customPlaceholders: [
            {
              id: "1",
              referenceName: "cleanPrice",
              sourcePlaceholder: "external::link::price0",
              steps: [
                {
                  type: CustomPlaceholderStepType.Regex,
                  regexSearch: "Price:\\s*",
                  replacementString: "",
                },
              ],
            },
          ],
        }
      );

      try {
        testServer.registerUrl(articleLink, () => ({
          body: `<html><body><span class="price">Price: $19.99</span></body></html>`,
        }));

        await ctx.seedArticles(eventWithExternal);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "regex-combo", title: "Test", link: articleLink }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithExternal);

        assert.notStrictEqual(results, null);

        const payload = getDiscordPayload(ctx);
        assert.strictEqual(payload.content, "Price: $19.99");
      } finally {
        testServer.unregisterUrl(articleLink);
        ctx.cleanup();
      }
    });

    it("preserves HTML formatting from external content", async () => {
      const ctx = createTestContext(stores);
      const testServer = getTestFeedRequestsServer();
      const articleLink = `https://example.com/article-${randomUUID()}`;

      const eventWithExternal = createEventWithExternalProperties(
        ctx.testFeedV2Event,
        {
          externalProperties: [
            { sourceField: "link", label: "content", cssSelector: ".content" },
          ],
          content: "{{external::link::content0}}",
        }
      );

      try {
        testServer.registerUrl(articleLink, () => ({
          body: `<html><body>
            <div class="content">
              <strong>Bold text</strong> and <em>italic text</em>
            </div>
          </body></html>`,
        }));

        await ctx.seedArticles(eventWithExternal);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "html-format", title: "Test", link: articleLink }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithExternal);

        assert.notStrictEqual(results, null);

        const payload = getDiscordPayload(ctx);
        // HTML should be converted to Discord markdown
        assert.ok(payload.content.includes("**Bold text**"));
        assert.ok(payload.content.includes("*italic text*"));
      } finally {
        testServer.unregisterUrl(articleLink);
        ctx.cleanup();
      }
    });
  });
});

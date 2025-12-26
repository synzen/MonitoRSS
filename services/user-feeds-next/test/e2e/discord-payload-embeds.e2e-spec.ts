import { describe, it, before, after } from "node:test";
import * as assert from "node:assert";
import { randomUUID } from "crypto";
import { ArticleDeliveryStatus } from "../../src/delivery";
import getTestRssFeed from "../data/test-rss-feed";
import { createTestContext } from "../helpers/test-context";
import type { FeedV2Event, EmbedInput } from "../../src/shared/schemas";
import { setupTestDatabase, teardownTestDatabase, type TestStores } from "../helpers/setup-integration-tests";

let stores: TestStores;

/**
 * Helper to create a feed event with embeds configured on the medium.
 * Uses EmbedInput[] (z.input) which allows omitting fields with defaults.
 */
function createEventWithEmbeds(
  baseEvent: FeedV2Event,
  embeds: EmbedInput[]
): FeedV2Event {
  return {
    ...baseEvent,
    data: {
      ...baseEvent.data,
      mediums: [
        {
          ...baseEvent.data.mediums[0]!,
          details: {
            ...baseEvent.data.mediums[0]!.details,
            content: "", // Clear content to focus on embeds
            embeds:
              embeds as FeedV2Event["data"]["mediums"][0]["details"]["embeds"],
          },
        },
      ],
    },
  };
}

/**
 * Helper to extract the Discord payload from captured requests.
 * Throws a descriptive error if no payloads were captured.
 */
function getDiscordPayload(ctx: ReturnType<typeof createTestContext>) {
  if (ctx.discordClient.capturedPayloads.length === 0) {
    throw new Error(
      `No Discord payloads captured. This usually means the article was not detected as new ` +
        `or was filtered out. Check that seedArticles() used different article GUIDs than the test.`
    );
  }
  return JSON.parse(
    ctx.discordClient.capturedPayloads[0]!.options.body as string
  );
}

describe("Discord Payload Embeds (e2e)", { concurrency: true }, () => {
  before(async () => {
    stores = await setupTestDatabase();
  });

  after(async () => {
    await teardownTestDatabase();
  });

  describe("Basic Embed Fields", () => {
    it("sends embed with title and description", async () => {
      const ctx = createTestContext(stores);

      const eventWithEmbeds = createEventWithEmbeds(ctx.testFeedV2Event, [
        {
          title: "{{title}}",
          description: "Article description: {{description}}",
        },
      ]);

      try {
        await ctx.seedArticles(eventWithEmbeds);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "embed-basic-test",
                title: "Test Article Title",
                description: "This is the article description",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithEmbeds);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);
        assert.strictEqual(results![0]!.status, ArticleDeliveryStatus.PendingDelivery);

        const payload = getDiscordPayload(ctx);
        assert.ok(Array.isArray(payload.embeds));
        assert.strictEqual(payload.embeds.length, 1);
        assert.strictEqual(payload.embeds[0].title, "Test Article Title");
        assert.strictEqual(payload.embeds[0].description, 
          "Article description: This is the article description"
        );
      } finally {
        ctx.cleanup();
      }
    });

    it("sends embed with url", async () => {
      const ctx = createTestContext(stores);

      const eventWithEmbeds = createEventWithEmbeds(ctx.testFeedV2Event, [
        {
          title: "{{title}}",
          url: "{{link}}",
        },
      ]);

      try {
        await ctx.seedArticles(eventWithEmbeds);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "embed-url-test",
                title: "Article with Link",
                link: "https://example.com/article/123",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithEmbeds);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);
        assert.strictEqual(payload.embeds[0].url, "https://example.com/article/123");
      } finally {
        ctx.cleanup();
      }
    });

    it("sends embed with color", async () => {
      const ctx = createTestContext(stores);

      const eventWithEmbeds = createEventWithEmbeds(ctx.testFeedV2Event, [
        {
          title: "{{title}}",
          color: 0xff5733, // Orange color
        },
      ]);

      try {
        await ctx.seedArticles(eventWithEmbeds);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "embed-color-test",
                title: "Colored Embed",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithEmbeds);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);
        assert.strictEqual(results![0]!.status, ArticleDeliveryStatus.PendingDelivery);

        const payload = getDiscordPayload(ctx);
        assert.strictEqual(payload.embeds[0].color, 0xff5733);
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Embed Footer", () => {
    it("sends embed with footer text", async () => {
      const ctx = createTestContext(stores);

      const eventWithEmbeds = createEventWithEmbeds(ctx.testFeedV2Event, [
        {
          title: "{{title}}",
          footer: {
            text: "Posted by {{author}}",
          },
        },
      ]);

      try {
        await ctx.seedArticles(eventWithEmbeds);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "embed-footer-test",
                title: "Article with Footer",
                author: "John Doe",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithEmbeds);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);
        assert.notStrictEqual(payload.embeds[0].footer, undefined);
        assert.strictEqual(payload.embeds[0].footer.text, "Posted by John Doe");
      } finally {
        ctx.cleanup();
      }
    });

    it("sends embed with footer icon_url", async () => {
      const ctx = createTestContext(stores);

      const eventWithEmbeds = createEventWithEmbeds(ctx.testFeedV2Event, [
        {
          title: "{{title}}",
          footer: {
            text: "Footer text",
            iconUrl: "https://example.com/icon.png",
          },
        },
      ]);

      try {
        await ctx.seedArticles(eventWithEmbeds);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "embed-footer-icon-test",
                title: "Article with Footer Icon",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithEmbeds);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);
        assert.strictEqual(payload.embeds[0].footer.icon_url, 
          "https://example.com/icon.png"
        );
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Embed Images", () => {
    it("sends embed with image", async () => {
      const ctx = createTestContext(stores);

      const eventWithEmbeds = createEventWithEmbeds(ctx.testFeedV2Event, [
        {
          title: "{{title}}",
          image: {
            url: "https://example.com/image.jpg",
          },
        },
      ]);

      try {
        await ctx.seedArticles(eventWithEmbeds);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "embed-image-test",
                title: "Article with Image",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithEmbeds);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);
        assert.notStrictEqual(payload.embeds[0].image, undefined);
        assert.strictEqual(payload.embeds[0].image.url, 
          "https://example.com/image.jpg"
        );
      } finally {
        ctx.cleanup();
      }
    });

    it("sends embed with thumbnail", async () => {
      const ctx = createTestContext(stores);

      const eventWithEmbeds = createEventWithEmbeds(ctx.testFeedV2Event, [
        {
          title: "{{title}}",
          thumbnail: {
            url: "https://example.com/thumbnail.jpg",
          },
        },
      ]);

      try {
        await ctx.seedArticles(eventWithEmbeds);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "embed-thumbnail-test",
                title: "Article with Thumbnail",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithEmbeds);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);
        assert.notStrictEqual(payload.embeds[0].thumbnail, undefined);
        assert.strictEqual(payload.embeds[0].thumbnail.url, 
          "https://example.com/thumbnail.jpg"
        );
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Embed Author", () => {
    it("sends embed with author name", async () => {
      const ctx = createTestContext(stores);

      const eventWithEmbeds = createEventWithEmbeds(ctx.testFeedV2Event, [
        {
          title: "{{title}}",
          author: {
            name: "{{author}}",
          },
        },
      ]);

      try {
        await ctx.seedArticles(eventWithEmbeds);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "embed-author-test",
                title: "Article with Author",
                author: "Jane Smith",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithEmbeds);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);
        assert.notStrictEqual(payload.embeds[0].author, undefined);
        assert.strictEqual(payload.embeds[0].author.name, "Jane Smith");
      } finally {
        ctx.cleanup();
      }
    });

    it("sends embed with author url and icon", async () => {
      const ctx = createTestContext(stores);

      const eventWithEmbeds = createEventWithEmbeds(ctx.testFeedV2Event, [
        {
          title: "{{title}}",
          author: {
            name: "Author Name",
            url: "https://example.com/author",
            iconUrl: "https://example.com/author-icon.png",
          },
        },
      ]);

      try {
        await ctx.seedArticles(eventWithEmbeds);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "embed-author-full-test",
                title: "Article with Full Author",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithEmbeds);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);
        assert.strictEqual(payload.embeds[0].author.url, "https://example.com/author");
        assert.strictEqual(payload.embeds[0].author.icon_url, 
          "https://example.com/author-icon.png"
        );
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Embed Fields", () => {
    it("sends embed with fields", async () => {
      const ctx = createTestContext(stores);

      const eventWithEmbeds = createEventWithEmbeds(ctx.testFeedV2Event, [
        {
          title: "{{title}}",
          fields: [
            {
              name: "Title Field",
              value: "{{title}}",
              inline: true,
            },
            {
              name: "Link Field",
              value: "{{link}}",
              inline: true,
            },
            {
              name: "Description Field",
              value: "{{description}}",
              inline: false,
            },
          ],
        },
      ]);

      try {
        await ctx.seedArticles(eventWithEmbeds);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "embed-fields-test",
                title: "Article with Fields",
                link: "https://example.com/article",
                description: "A detailed description",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithEmbeds);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);
        assert.ok(Array.isArray(payload.embeds[0].fields));
        assert.strictEqual(payload.embeds[0].fields.length, 3);

        assert.strictEqual(payload.embeds[0].fields[0].name, "Title Field");
        assert.strictEqual(payload.embeds[0].fields[0].value, "Article with Fields");
        assert.strictEqual(payload.embeds[0].fields[0].inline, true);

        assert.strictEqual(payload.embeds[0].fields[1].name, "Link Field");
        assert.strictEqual(payload.embeds[0].fields[1].value, 
          "https://example.com/article"
        );
        assert.strictEqual(payload.embeds[0].fields[1].inline, true);

        assert.strictEqual(payload.embeds[0].fields[2].name, "Description Field");
        assert.strictEqual(payload.embeds[0].fields[2].value, 
          "A detailed description"
        );
        assert.strictEqual(payload.embeds[0].fields[2].inline, false);
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Embed Timestamp", () => {
    it("sends embed with 'now' timestamp", async () => {
      const ctx = createTestContext(stores);

      const eventWithEmbeds = createEventWithEmbeds(ctx.testFeedV2Event, [
        {
          title: "{{title}}",
          timestamp: "now",
        },
      ]);

      try {
        await ctx.seedArticles(eventWithEmbeds);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "embed-timestamp-now-test",
                title: "Article with Now Timestamp",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithEmbeds);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);
        assert.notStrictEqual(payload.embeds[0].timestamp, undefined);
        // Timestamp should be a valid ISO string
        assert.ok(new Date(payload.embeds[0].timestamp));
      } finally {
        ctx.cleanup();
      }
    });

    it("sends embed with 'article' timestamp", async () => {
      const ctx = createTestContext(stores);

      const eventWithEmbeds = createEventWithEmbeds(ctx.testFeedV2Event, [
        {
          title: "{{title}}",
          timestamp: "article",
        },
      ]);

      const articleDate = new Date("2024-06-15T12:00:00Z");

      try {
        await ctx.seedArticles(eventWithEmbeds);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "embed-timestamp-article-test",
                title: "Article with Article Timestamp",
                pubDate: articleDate.toISOString(),
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithEmbeds);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);
        assert.notStrictEqual(payload.embeds[0].timestamp, undefined);
        // Timestamp should match the article's publish date
        const payloadDate = new Date(payload.embeds[0].timestamp);
        assert.strictEqual(payloadDate.getTime(), articleDate.getTime());
      } finally {
        ctx.cleanup();
      }
    });

    it("sends embed without timestamp when set to empty string", async () => {
      const ctx = createTestContext(stores);

      const eventWithEmbeds = createEventWithEmbeds(ctx.testFeedV2Event, [
        {
          title: "{{title}}",
          timestamp: "",
        },
      ]);

      try {
        await ctx.seedArticles(eventWithEmbeds);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "embed-no-timestamp-test",
                title: "Article without Timestamp",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithEmbeds);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);
        assert.strictEqual(results![0]!.status, ArticleDeliveryStatus.PendingDelivery);

        const payload = getDiscordPayload(ctx);
        // Timestamp should be undefined or not present
        assert.ok(!payload.embeds[0].timestamp);
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Multiple Embeds", () => {
    it("sends message with multiple embeds", async () => {
      const ctx = createTestContext(stores);

      const eventWithEmbeds = createEventWithEmbeds(ctx.testFeedV2Event, [
        {
          title: "First Embed: {{title}}",
          color: 0xff0000,
        },
        {
          title: "Second Embed",
          description: "{{description}}",
          color: 0x00ff00,
        },
        {
          title: "Third Embed",
          footer: { text: "Footer text" },
          color: 0x0000ff,
        },
      ]);

      try {
        await ctx.seedArticles(eventWithEmbeds);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "multiple-embeds-test",
                title: "Multi-Embed Article",
                description: "Description for second embed",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithEmbeds);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);
        assert.ok(Array.isArray(payload.embeds));
        assert.strictEqual(payload.embeds.length, 3);

        assert.strictEqual(payload.embeds[0].title, 
          "First Embed: Multi-Embed Article"
        );
        assert.strictEqual(payload.embeds[0].color, 0xff0000);

        assert.strictEqual(payload.embeds[1].title, "Second Embed");
        assert.strictEqual(payload.embeds[1].description, "Description for second embed");
        assert.strictEqual(payload.embeds[1].color, 0x00ff00);

        assert.strictEqual(payload.embeds[2].title, "Third Embed");
        assert.strictEqual(payload.embeds[2].footer.text, "Footer text");
        assert.strictEqual(payload.embeds[2].color, 0x0000ff);
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Complete Embed", () => {
    it("sends embed with all fields populated", async () => {
      const ctx = createTestContext(stores);

      const eventWithEmbeds = createEventWithEmbeds(ctx.testFeedV2Event, [
        {
          title: "{{title}}",
          description: "{{description}}",
          url: "{{link}}",
          color: 0x5865f2,
          author: {
            name: "Static Author",
            url: "https://example.com/author",
            iconUrl: "https://example.com/author-icon.png",
          },
          thumbnail: {
            url: "https://example.com/thumb.png",
          },
          image: {
            url: "https://example.com/image.png",
          },
          footer: {
            text: "Via RSS Feed",
            iconUrl: "https://example.com/footer-icon.png",
          },
          fields: [{ name: "Source", value: "{{link}}", inline: true }],
          timestamp: "article",
        },
      ]);

      const articleDate = new Date("2024-07-20T15:30:00Z");

      try {
        await ctx.seedArticles(eventWithEmbeds);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "complete-embed-test",
                title: "Complete Article",
                description: "Full description here",
                link: "https://example.com/article/full",
                author: "Complete Author",
                pubDate: articleDate.toISOString(),
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithEmbeds);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);
        const embed = payload.embeds[0];

        assert.strictEqual(embed.title, "Complete Article");
        assert.strictEqual(embed.description, "Full description here");
        assert.strictEqual(embed.url, "https://example.com/article/full");
        assert.strictEqual(embed.color, 0x5865f2);
        assert.strictEqual(embed.author.name, "Static Author");
        assert.strictEqual(embed.author.url, "https://example.com/author");
        assert.strictEqual(embed.author.icon_url, 
          "https://example.com/author-icon.png"
        );
        assert.strictEqual(embed.thumbnail.url, "https://example.com/thumb.png");
        assert.strictEqual(embed.image.url, "https://example.com/image.png");
        assert.strictEqual(embed.footer.text, "Via RSS Feed");
        assert.strictEqual(embed.footer.icon_url, 
          "https://example.com/footer-icon.png"
        );
        assert.strictEqual(embed.fields[0].name, "Source");
        assert.strictEqual(embed.fields[0].value, "https://example.com/article/full");
        assert.strictEqual(new Date(embed.timestamp).getTime(), articleDate.getTime());
      } finally {
        ctx.cleanup();
      }
    });
  });
});

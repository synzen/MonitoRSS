import { describe, it, before, after } from "node:test";
import * as assert from "node:assert";
import { randomUUID } from "crypto";
import { ArticleDeliveryStatus } from "../../src/delivery";
import getTestRssFeed from "../data/test-rss-feed";
import { createTestContext } from "../helpers/test-context";
import { setupTestDatabase, teardownTestDatabase, type TestStores } from "../helpers/setup-integration-tests";
import type { FeedV2Event, ComponentV2Input } from "../../src/shared/schemas";

let stores: TestStores;

type MediumDetails = FeedV2Event["data"]["mediums"][0]["details"];

/**
 * Helper to create a feed event with V2 components configured on the medium.
 */
function createEventWithComponentsV2(
  baseEvent: FeedV2Event,
  componentsV2Input: ComponentV2Input[]
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
            content: "", // Clear content to focus on components
            componentsV2: componentsV2Input as MediumDetails["componentsV2"],
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

describe("Discord Payload Components V2 (e2e)", { concurrency: true }, () => {
  before(async () => {
    stores = await setupTestDatabase();
  });

  after(async () => {
    await teardownTestDatabase();
  });

  describe("TEXT_DISPLAY Component", () => {
    it("sends message with TEXT_DISPLAY component", async () => {
      const ctx = createTestContext(stores);

      const eventWithComponentsV2 = createEventWithComponentsV2(
        ctx.testFeedV2Event,
        [
          {
            type: "SECTION",
            components: [
              {
                type: "TEXT_DISPLAY",
                content: "Article: {{title}}",
              },
            ],
            accessory: {
              type: "BUTTON",
              style: 5,
              label: "Link",
              url: "{{link}}",
            },
          },
        ]
      );

      try {
        await ctx.seedArticles(eventWithComponentsV2);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "text-display-test",
                title: "Text Display Article",
                link: "https://example.com/text",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithComponentsV2);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);
        assert.strictEqual(results![0]!.status, ArticleDeliveryStatus.PendingDelivery);

        const payload = getDiscordPayload(ctx);
        assert.ok(Array.isArray(payload.components));
        assert.ok(payload.components.length > 0);

        // Find the section component
        const section = payload.components.find(
          (c: { type: number }) => c.type === 9
        ); // Section type
        assert.notStrictEqual(section, undefined);

        // Check text display within section
        const textDisplay = section.components.find(
          (c: { type: number }) => c.type === 10
        ); // TextDisplay type
        assert.notStrictEqual(textDisplay, undefined);
        assert.strictEqual(textDisplay.content, "Article: Text Display Article");
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("THUMBNAIL Component", () => {
    it("sends message with THUMBNAIL accessory", async () => {
      const ctx = createTestContext(stores);

      const eventWithComponentsV2 = createEventWithComponentsV2(
        ctx.testFeedV2Event,
        [
          {
            type: "SECTION",
            components: [
              {
                type: "TEXT_DISPLAY",
                content: "{{title}}",
              },
            ],
            accessory: {
              type: "THUMBNAIL",
              media: { url: "https://example.com/thumb.png" },
              description: "Article thumbnail",
              spoiler: false,
            },
          },
        ]
      );

      try {
        await ctx.seedArticles(eventWithComponentsV2);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "thumbnail-test",
                title: "Thumbnail Article",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithComponentsV2);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);
        const section = payload.components.find(
          (c: { type: number }) => c.type === 9
        );
        assert.notStrictEqual(section, undefined);

        // Check accessory (thumbnail)
        assert.notStrictEqual(section.accessory, undefined);
        assert.strictEqual(section.accessory.type, 11); // Thumbnail type
        assert.strictEqual(section.accessory.media.url, "https://example.com/thumb.png");
      } finally {
        ctx.cleanup();
      }
    });

    it("sends THUMBNAIL with spoiler", async () => {
      const ctx = createTestContext(stores);

      const eventWithComponentsV2 = createEventWithComponentsV2(
        ctx.testFeedV2Event,
        [
          {
            type: "SECTION",
            components: [
              {
                type: "TEXT_DISPLAY",
                content: "{{title}}",
              },
            ],
            accessory: {
              type: "THUMBNAIL",
              media: { url: "https://example.com/spoiler.png" },
              spoiler: true,
            },
          },
        ]
      );

      try {
        await ctx.seedArticles(eventWithComponentsV2);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "thumbnail-spoiler-test",
                title: "Spoiler Article",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithComponentsV2);

        assert.notStrictEqual(results, null);

        const payload = getDiscordPayload(ctx);
        const section = payload.components.find(
          (c: { type: number }) => c.type === 9
        );
        assert.strictEqual(section.accessory.spoiler, true);
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("ACTION_ROW V2 Component", () => {
    it("sends message with ACTION_ROW containing buttons", async () => {
      const ctx = createTestContext(stores);

      const eventWithComponentsV2 = createEventWithComponentsV2(
        ctx.testFeedV2Event,
        [
          {
            type: "ACTION_ROW",
            components: [
              {
                type: "BUTTON",
                style: 5,
                label: "Read Article",
                url: "{{link}}",
              },
              {
                type: "BUTTON",
                style: 5,
                label: "Share",
                url: "https://example.com/share",
              },
            ],
          },
        ]
      );

      try {
        await ctx.seedArticles(eventWithComponentsV2);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "action-row-v2-test",
                title: "Action Row V2 Article",
                link: "https://example.com/action-row",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithComponentsV2);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);
        const actionRow = payload.components.find(
          (c: { type: number }) => c.type === 1
        ); // ActionRow type
        assert.notStrictEqual(actionRow, undefined);
        assert.ok(Array.isArray(actionRow.components));
        assert.strictEqual(actionRow.components.length, 2);

        assert.strictEqual(actionRow.components[0].label, "Read Article");
        assert.strictEqual(actionRow.components[0].url, "https://example.com/action-row");
        assert.strictEqual(actionRow.components[1].label, "Share");
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("SEPARATOR Component", () => {
    it("sends message with SEPARATOR component", async () => {
      const ctx = createTestContext(stores);

      const eventWithComponentsV2 = createEventWithComponentsV2(
        ctx.testFeedV2Event,
        [
          {
            type: "SECTION",
            components: [
              {
                type: "TEXT_DISPLAY",
                content: "{{title}}",
              },
            ],
            accessory: {
              type: "BUTTON",
              style: 5,
              label: "Link",
              url: "{{link}}",
            },
          },
          {
            type: "SEPARATOR",
            divider: true,
            spacing: 2,
          },
          {
            type: "SECTION",
            components: [
              {
                type: "TEXT_DISPLAY",
                content: "{{description}}",
              },
            ],
            accessory: {
              type: "BUTTON",
              style: 5,
              label: "More",
              url: "https://example.com",
            },
          },
        ]
      );

      try {
        await ctx.seedArticles(eventWithComponentsV2);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "separator-test",
                title: "Separated Article",
                description: "Description text",
                link: "https://example.com/sep",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithComponentsV2);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);
        const separator = payload.components.find(
          (c: { type: number }) => c.type === 14
        ); // Separator type
        assert.notStrictEqual(separator, undefined);
        assert.strictEqual(separator.divider, true);
        assert.strictEqual(separator.spacing, 2);
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("MEDIA_GALLERY Component", () => {
    it("sends message with MEDIA_GALLERY component", async () => {
      const ctx = createTestContext(stores);

      const eventWithComponentsV2 = createEventWithComponentsV2(
        ctx.testFeedV2Event,
        [
          {
            type: "CONTAINER",
            components: [
              {
                type: "TEXT_DISPLAY",
                content: "Gallery: {{title}}",
              },
              {
                type: "MEDIA_GALLERY",
                items: [
                  {
                    media: { url: "https://example.com/image1.jpg" },
                    description: "First image",
                    spoiler: false,
                  },
                  {
                    media: { url: "https://example.com/image2.jpg" },
                    description: "Second image",
                    spoiler: false,
                  },
                ],
              },
            ],
          },
        ]
      );

      try {
        await ctx.seedArticles(eventWithComponentsV2);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "media-gallery-test",
                title: "Gallery Article",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithComponentsV2);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);
        const container = payload.components.find(
          (c: { type: number }) => c.type === 17
        ); // Container type
        assert.notStrictEqual(container, undefined);

        const gallery = container.components.find(
          (c: { type: number }) => c.type === 12
        ); // MediaGallery type
        assert.notStrictEqual(gallery, undefined);
        assert.ok(Array.isArray(gallery.items));
        assert.strictEqual(gallery.items.length, 2);
        assert.strictEqual(gallery.items[0].media.url, "https://example.com/image1.jpg");
        assert.strictEqual(gallery.items[1].media.url, "https://example.com/image2.jpg");
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("CONTAINER Component", () => {
    it("sends message with CONTAINER and accent_color", async () => {
      const ctx = createTestContext(stores);

      const eventWithComponentsV2 = createEventWithComponentsV2(
        ctx.testFeedV2Event,
        [
          {
            type: "CONTAINER",
            accent_color: 0xff5733,
            spoiler: false,
            components: [
              {
                type: "TEXT_DISPLAY",
                content: "Container content: {{title}}",
              },
            ],
          },
        ]
      );

      try {
        await ctx.seedArticles(eventWithComponentsV2);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "container-test",
                title: "Container Article",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithComponentsV2);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);
        const container = payload.components.find(
          (c: { type: number }) => c.type === 17
        ); // Container type
        assert.notStrictEqual(container, undefined);
        assert.strictEqual(container.accent_color, 0xff5733);
      } finally {
        ctx.cleanup();
      }
    });

    it("sends CONTAINER with spoiler", async () => {
      const ctx = createTestContext(stores);

      const eventWithComponentsV2 = createEventWithComponentsV2(
        ctx.testFeedV2Event,
        [
          {
            type: "CONTAINER",
            spoiler: true,
            components: [
              {
                type: "TEXT_DISPLAY",
                content: "Spoiler content: {{title}}",
              },
            ],
          },
        ]
      );

      try {
        await ctx.seedArticles(eventWithComponentsV2);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "container-spoiler-test",
                title: "Spoiler Container Article",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithComponentsV2);

        assert.notStrictEqual(results, null);

        const payload = getDiscordPayload(ctx);
        const container = payload.components.find(
          (c: { type: number }) => c.type === 17
        );
        assert.strictEqual(container.spoiler, true);
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("SECTION with Accessory", () => {
    it("sends SECTION with BUTTON accessory", async () => {
      const ctx = createTestContext(stores);

      const eventWithComponentsV2 = createEventWithComponentsV2(
        ctx.testFeedV2Event,
        [
          {
            type: "SECTION",
            components: [
              {
                type: "TEXT_DISPLAY",
                content: "{{title}}",
              },
              {
                type: "TEXT_DISPLAY",
                content: "{{description}}",
              },
            ],
            accessory: {
              type: "BUTTON",
              style: 5,
              label: "Open",
              url: "{{link}}",
              disabled: false,
            },
          },
        ]
      );

      try {
        await ctx.seedArticles(eventWithComponentsV2);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "section-button-test",
                title: "Section Title",
                description: "Section description",
                link: "https://example.com/section",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithComponentsV2);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);
        const section = payload.components.find(
          (c: { type: number }) => c.type === 9
        );
        assert.notStrictEqual(section, undefined);

        // Check text displays
        assert.strictEqual(section.components.length, 2);

        // Check button accessory
        assert.notStrictEqual(section.accessory, undefined);
        assert.strictEqual(section.accessory.type, 2); // Button type
        assert.strictEqual(section.accessory.label, "Open");
        assert.strictEqual(section.accessory.url, "https://example.com/section");
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Complex Component Layouts", () => {
    it("sends message with multiple V2 component types", async () => {
      const ctx = createTestContext(stores);

      const eventWithComponentsV2 = createEventWithComponentsV2(
        ctx.testFeedV2Event,
        [
          {
            type: "CONTAINER",
            accent_color: 0x5865f2,
            components: [
              {
                type: "TEXT_DISPLAY",
                content: "**{{title}}**",
              },
              {
                type: "SEPARATOR",
                divider: true,
                spacing: 1,
              },
              {
                type: "TEXT_DISPLAY",
                content: "{{description}}",
              },
              {
                type: "ACTION_ROW",
                components: [
                  {
                    type: "BUTTON",
                    style: 5,
                    label: "Read More",
                    url: "{{link}}",
                  },
                ],
              },
            ],
          },
        ]
      );

      try {
        await ctx.seedArticles(eventWithComponentsV2);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "complex-v2-test",
                title: "Complex Article",
                description: "Complex description",
                link: "https://example.com/complex",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithComponentsV2);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);

        // Find the container
        const container = payload.components.find(
          (c: { type: number }) => c.type === 17
        );
        assert.notStrictEqual(container, undefined);
        assert.strictEqual(container.accent_color, 0x5865f2);

        // Should have 4 child components
        assert.strictEqual(container.components.length, 4);

        // First text display
        const firstText = container.components[0];
        assert.strictEqual(firstText.type, 10);
        assert.strictEqual(firstText.content, "**Complex Article**");

        // Separator
        const separator = container.components[1];
        assert.strictEqual(separator.type, 14);

        // Second text display
        const secondText = container.components[2];
        assert.strictEqual(secondText.content, "Complex description");

        // Action row
        const actionRow = container.components[3];
        assert.strictEqual(actionRow.type, 1);
        assert.strictEqual(actionRow.components[0].url, "https://example.com/complex");
      } finally {
        ctx.cleanup();
      }
    });
  });
});

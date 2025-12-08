import { describe, it, expect } from "bun:test";
import { randomUUID } from "crypto";
import { ArticleDeliveryStatus } from "../../src/delivery";
import getTestRssFeed from "../data/test-rss-feed";
import { createTestContext } from "../helpers/test-context";
import type { FeedV2Event, ComponentV2Input } from "../../src/shared/schemas";

// Note: Test infrastructure setup/teardown is handled by test/setup.ts (preload file)

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
  expect(ctx.discordClient.capturedPayloads.length).toBeGreaterThan(0);
  return JSON.parse(
    ctx.discordClient.capturedPayloads[0]!.options.body as string
  );
}

describe("Discord Payload Components V2 (e2e)", () => {
  describe("TEXT_DISPLAY Component", () => {
    it("sends message with TEXT_DISPLAY component", async () => {
      const ctx = createTestContext();

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

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);
        expect(results![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);

        const payload = getDiscordPayload(ctx);
        expect(payload.components).toBeArray();
        expect(payload.components.length).toBeGreaterThan(0);

        // Find the section component
        const section = payload.components.find(
          (c: { type: number }) => c.type === 9
        ); // Section type
        expect(section).toBeDefined();

        // Check text display within section
        const textDisplay = section.components.find(
          (c: { type: number }) => c.type === 10
        ); // TextDisplay type
        expect(textDisplay).toBeDefined();
        expect(textDisplay.content).toBe("Article: Text Display Article");
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("THUMBNAIL Component", () => {
    it("sends message with THUMBNAIL accessory", async () => {
      const ctx = createTestContext();

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

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);

        const payload = getDiscordPayload(ctx);
        const section = payload.components.find(
          (c: { type: number }) => c.type === 9
        );
        expect(section).toBeDefined();

        // Check accessory (thumbnail)
        expect(section.accessory).toBeDefined();
        expect(section.accessory.type).toBe(11); // Thumbnail type
        expect(section.accessory.media.url).toBe(
          "https://example.com/thumb.png"
        );
      } finally {
        ctx.cleanup();
      }
    });

    it("sends THUMBNAIL with spoiler", async () => {
      const ctx = createTestContext();

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

        expect(results).not.toBeNull();

        const payload = getDiscordPayload(ctx);
        const section = payload.components.find(
          (c: { type: number }) => c.type === 9
        );
        expect(section.accessory.spoiler).toBe(true);
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("ACTION_ROW V2 Component", () => {
    it("sends message with ACTION_ROW containing buttons", async () => {
      const ctx = createTestContext();

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

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);

        const payload = getDiscordPayload(ctx);
        const actionRow = payload.components.find(
          (c: { type: number }) => c.type === 1
        ); // ActionRow type
        expect(actionRow).toBeDefined();
        expect(actionRow.components).toBeArray();
        expect(actionRow.components.length).toBe(2);

        expect(actionRow.components[0].label).toBe("Read Article");
        expect(actionRow.components[0].url).toBe(
          "https://example.com/action-row"
        );
        expect(actionRow.components[1].label).toBe("Share");
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("SEPARATOR Component", () => {
    it("sends message with SEPARATOR component", async () => {
      const ctx = createTestContext();

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

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);

        const payload = getDiscordPayload(ctx);
        const separator = payload.components.find(
          (c: { type: number }) => c.type === 14
        ); // Separator type
        expect(separator).toBeDefined();
        expect(separator.divider).toBe(true);
        expect(separator.spacing).toBe(2);
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("MEDIA_GALLERY Component", () => {
    it("sends message with MEDIA_GALLERY component", async () => {
      const ctx = createTestContext();

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

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);

        const payload = getDiscordPayload(ctx);
        const container = payload.components.find(
          (c: { type: number }) => c.type === 17
        ); // Container type
        expect(container).toBeDefined();

        const gallery = container.components.find(
          (c: { type: number }) => c.type === 12
        ); // MediaGallery type
        expect(gallery).toBeDefined();
        expect(gallery.items).toBeArray();
        expect(gallery.items.length).toBe(2);
        expect(gallery.items[0].media.url).toBe(
          "https://example.com/image1.jpg"
        );
        expect(gallery.items[1].media.url).toBe(
          "https://example.com/image2.jpg"
        );
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("CONTAINER Component", () => {
    it("sends message with CONTAINER and accent_color", async () => {
      const ctx = createTestContext();

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

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);

        const payload = getDiscordPayload(ctx);
        const container = payload.components.find(
          (c: { type: number }) => c.type === 17
        ); // Container type
        expect(container).toBeDefined();
        expect(container.accent_color).toBe(0xff5733);
      } finally {
        ctx.cleanup();
      }
    });

    it("sends CONTAINER with spoiler", async () => {
      const ctx = createTestContext();

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

        expect(results).not.toBeNull();

        const payload = getDiscordPayload(ctx);
        const container = payload.components.find(
          (c: { type: number }) => c.type === 17
        );
        expect(container.spoiler).toBe(true);
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("SECTION with Accessory", () => {
    it("sends SECTION with BUTTON accessory", async () => {
      const ctx = createTestContext();

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

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);

        const payload = getDiscordPayload(ctx);
        const section = payload.components.find(
          (c: { type: number }) => c.type === 9
        );
        expect(section).toBeDefined();

        // Check text displays
        expect(section.components.length).toBe(2);

        // Check button accessory
        expect(section.accessory).toBeDefined();
        expect(section.accessory.type).toBe(2); // Button type
        expect(section.accessory.label).toBe("Open");
        expect(section.accessory.url).toBe("https://example.com/section");
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Complex Component Layouts", () => {
    it("sends message with multiple V2 component types", async () => {
      const ctx = createTestContext();

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

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);

        const payload = getDiscordPayload(ctx);

        // Find the container
        const container = payload.components.find(
          (c: { type: number }) => c.type === 17
        );
        expect(container).toBeDefined();
        expect(container.accent_color).toBe(0x5865f2);

        // Should have 4 child components
        expect(container.components.length).toBe(4);

        // First text display
        const firstText = container.components[0];
        expect(firstText.type).toBe(10);
        expect(firstText.content).toBe("**Complex Article**");

        // Separator
        const separator = container.components[1];
        expect(separator.type).toBe(14);

        // Second text display
        const secondText = container.components[2];
        expect(secondText.content).toBe("Complex description");

        // Action row
        const actionRow = container.components[3];
        expect(actionRow.type).toBe(1);
        expect(actionRow.components[0].url).toBe("https://example.com/complex");
      } finally {
        ctx.cleanup();
      }
    });
  });
});

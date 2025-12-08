import { describe, it, expect } from "bun:test";
import { randomUUID } from "crypto";
import { ArticleDeliveryStatus } from "../../src/delivery";
import { DiscordComponentType } from "../../src/shared/constants";
import getTestRssFeed from "../data/test-rss-feed";
import { createTestContext } from "../helpers/test-context";
import type { FeedV2Event } from "../../src/shared/schemas";

// Note: Test infrastructure setup/teardown is handled by test/setup.ts (preload file)

type ComponentsArray = NonNullable<
  FeedV2Event["data"]["mediums"][0]["details"]["components"]
>;

/**
 * Helper to create a feed event with components configured on the medium.
 * Note: Components require content or embeds to be present for the payload to be generated.
 */
function createEventWithComponents(
  baseEvent: FeedV2Event,
  components: ComponentsArray,
  content?: string
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
            content: content ?? "{{title}}", // Need content for payload to be generated
            components,
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

describe("Discord Payload Components V1 (e2e)", () => {
  describe("Action Row with Buttons", () => {
    it("sends message with a single button", async () => {
      const ctx = createTestContext();

      const eventWithComponents = createEventWithComponents(
        ctx.testFeedV2Event,
        [
          {
            type: DiscordComponentType.ActionRow,
            components: [
              {
                type: DiscordComponentType.Button,
                style: 5, // Link button
                label: "Read More",
                url: "{{link}}",
                emoji: null,
              },
            ],
          },
        ]
      );

      try {
        await ctx.seedArticles(eventWithComponents);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "button-single-test",
                title: "Article with Button",
                link: "https://example.com/article/1",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithComponents);

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);
        expect(results![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);

        const payload = getDiscordPayload(ctx);
        expect(payload.components).toBeArray();
        expect(payload.components.length).toBe(1);

        const actionRow = payload.components[0];
        expect(actionRow.type).toBe(1); // ActionRow type number
        expect(actionRow.components).toBeArray();
        expect(actionRow.components.length).toBe(1);

        const button = actionRow.components[0];
        expect(button.type).toBe(2); // Button type number
        expect(button.style).toBe(5);
        expect(button.label).toBe("Read More");
        expect(button.url).toBe("https://example.com/article/1");
      } finally {
        ctx.cleanup();
      }
    });

    it("sends message with multiple buttons in action row", async () => {
      const ctx = createTestContext();

      const eventWithComponents = createEventWithComponents(
        ctx.testFeedV2Event,
        [
          {
            type: DiscordComponentType.ActionRow,
            components: [
              {
                type: DiscordComponentType.Button,
                style: 5,
                label: "Article Link",
                url: "{{link}}",
                emoji: null,
              },
              {
                type: DiscordComponentType.Button,
                style: 5,
                label: "Source",
                url: "https://example.com",
                emoji: null,
              },
            ],
          },
        ]
      );

      try {
        await ctx.seedArticles(eventWithComponents);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "button-multiple-test",
                title: "Article with Multiple Buttons",
                link: "https://example.com/article/2",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithComponents);

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);

        const payload = getDiscordPayload(ctx);
        const actionRow = payload.components[0];
        expect(actionRow.components.length).toBe(2);

        expect(actionRow.components[0].label).toBe("Article Link");
        expect(actionRow.components[0].url).toBe(
          "https://example.com/article/2"
        );

        expect(actionRow.components[1].label).toBe("Source");
        expect(actionRow.components[1].url).toBe("https://example.com");
      } finally {
        ctx.cleanup();
      }
    });

    it("sends message with multiple action rows", async () => {
      const ctx = createTestContext();

      const eventWithComponents = createEventWithComponents(
        ctx.testFeedV2Event,
        [
          {
            type: DiscordComponentType.ActionRow,
            components: [
              {
                type: DiscordComponentType.Button,
                style: 5,
                label: "Row 1 Button",
                url: "{{link}}",
                emoji: null,
              },
            ],
          },
          {
            type: DiscordComponentType.ActionRow,
            components: [
              {
                type: DiscordComponentType.Button,
                style: 5,
                label: "Row 2 Button",
                url: "https://example.com/other",
                emoji: null,
              },
            ],
          },
        ]
      );

      try {
        await ctx.seedArticles(eventWithComponents);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "button-rows-test",
                title: "Article with Multiple Rows",
                link: "https://example.com/article/3",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithComponents);

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);

        const payload = getDiscordPayload(ctx);
        expect(payload.components.length).toBe(2);

        expect(payload.components[0].components[0].label).toBe("Row 1 Button");
        expect(payload.components[1].components[0].label).toBe("Row 2 Button");
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Button Styles", () => {
    it("sends button with style 1 (Primary)", async () => {
      const ctx = createTestContext();

      const eventWithComponents = createEventWithComponents(
        ctx.testFeedV2Event,
        [
          {
            type: DiscordComponentType.ActionRow,
            components: [
              {
                type: DiscordComponentType.Button,
                style: 1,
                label: "Primary Button",
                url: null,
                emoji: null,
              },
            ],
          },
        ]
      );

      try {
        await ctx.seedArticles(eventWithComponents);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "button-style-1-test",
                title: "Primary Style Article",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithComponents);

        expect(results).not.toBeNull();

        const payload = getDiscordPayload(ctx);
        expect(payload.components[0].components[0].style).toBe(1);
      } finally {
        ctx.cleanup();
      }
    });

    it("sends button with different styles (1-5)", async () => {
      const ctx = createTestContext();

      const eventWithComponents = createEventWithComponents(
        ctx.testFeedV2Event,
        [
          {
            type: DiscordComponentType.ActionRow,
            components: [
              {
                type: DiscordComponentType.Button,
                style: 1, // Primary
                label: "Primary",
                url: null,
                emoji: null,
              },
              {
                type: DiscordComponentType.Button,
                style: 2, // Secondary
                label: "Secondary",
                url: null,
                emoji: null,
              },
              {
                type: DiscordComponentType.Button,
                style: 3, // Success
                label: "Success",
                url: null,
                emoji: null,
              },
              {
                type: DiscordComponentType.Button,
                style: 4, // Danger
                label: "Danger",
                url: null,
                emoji: null,
              },
              {
                type: DiscordComponentType.Button,
                style: 5, // Link
                label: "Link",
                url: "https://example.com",
                emoji: null,
              },
            ],
          },
        ]
      );

      try {
        await ctx.seedArticles(eventWithComponents);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "button-styles-all-test",
                title: "All Styles Article",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithComponents);

        expect(results).not.toBeNull();

        const payload = getDiscordPayload(ctx);
        const buttons = payload.components[0].components;

        expect(buttons[0].style).toBe(1);
        expect(buttons[0].label).toBe("Primary");

        expect(buttons[1].style).toBe(2);
        expect(buttons[1].label).toBe("Secondary");

        expect(buttons[2].style).toBe(3);
        expect(buttons[2].label).toBe("Success");

        expect(buttons[3].style).toBe(4);
        expect(buttons[3].label).toBe("Danger");

        expect(buttons[4].style).toBe(5);
        expect(buttons[4].label).toBe("Link");
        expect(buttons[4].url).toBe("https://example.com");
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Button with Emoji", () => {
    it("sends button with custom emoji", async () => {
      const ctx = createTestContext();

      const eventWithComponents = createEventWithComponents(
        ctx.testFeedV2Event,
        [
          {
            type: DiscordComponentType.ActionRow,
            components: [
              {
                type: DiscordComponentType.Button,
                style: 5,
                label: "Read",
                url: "{{link}}",
                emoji: {
                  id: "123456789",
                  name: "custom_emoji",
                  animated: false,
                },
              },
            ],
          },
        ]
      );

      try {
        await ctx.seedArticles(eventWithComponents);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "button-emoji-test",
                title: "Emoji Button Article",
                link: "https://example.com/emoji-article",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithComponents);

        expect(results).not.toBeNull();

        const payload = getDiscordPayload(ctx);
        const button = payload.components[0].components[0];

        expect(button.emoji).toBeDefined();
        expect(button.emoji.id).toBe("123456789");
        expect(button.emoji.name).toBe("custom_emoji");
        expect(button.emoji.animated).toBe(false);
      } finally {
        ctx.cleanup();
      }
    });

    it("sends button with animated emoji", async () => {
      const ctx = createTestContext();

      const eventWithComponents = createEventWithComponents(
        ctx.testFeedV2Event,
        [
          {
            type: DiscordComponentType.ActionRow,
            components: [
              {
                type: DiscordComponentType.Button,
                style: 5,
                label: "Animated",
                url: "{{link}}",
                emoji: {
                  id: "987654321",
                  name: "animated_emoji",
                  animated: true,
                },
              },
            ],
          },
        ]
      );

      try {
        await ctx.seedArticles(eventWithComponents);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "button-animated-emoji-test",
                title: "Animated Emoji Article",
                link: "https://example.com/animated",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithComponents);

        expect(results).not.toBeNull();

        const payload = getDiscordPayload(ctx);
        const button = payload.components[0].components[0];

        expect(button.emoji.animated).toBe(true);
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Button URL Placeholders", () => {
    it("replaces placeholders in button URL", async () => {
      const ctx = createTestContext();

      const eventWithComponents = createEventWithComponents(
        ctx.testFeedV2Event,
        [
          {
            type: DiscordComponentType.ActionRow,
            components: [
              {
                type: DiscordComponentType.Button,
                style: 5,
                label: "View {{title}}",
                url: "{{link}}",
                emoji: null,
              },
            ],
          },
        ]
      );

      try {
        await ctx.seedArticles(eventWithComponents);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "button-placeholder-test",
                title: "Dynamic Article",
                link: "https://example.com/dynamic/article",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithComponents);

        expect(results).not.toBeNull();

        const payload = getDiscordPayload(ctx);
        const button = payload.components[0].components[0];

        expect(button.label).toBe("View Dynamic Article");
        expect(button.url).toBe("https://example.com/dynamic/article");
      } finally {
        ctx.cleanup();
      }
    });
  });
});

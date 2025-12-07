import { describe, it, expect } from "bun:test";
import { randomUUID } from "crypto";
import { ArticleDeliveryStatus } from "../src/delivery";
import { CustomPlaceholderStepType } from "../src/constants";
import getTestRssFeed from "./data/test-rss-feed";
import { createTestContext } from "./helpers/test-context";
import type { FeedV2Event } from "../src/schemas";

// Note: Test infrastructure setup/teardown is handled by test/setup.ts (preload file)

type MediumDetails = FeedV2Event["data"]["mediums"][0]["details"];

/**
 * Helper to create a feed event with custom placeholders configured.
 * Uses type assertion to avoid strict type checking on embed fields.
 */
function createEventWithCustomPlaceholders(
  baseEvent: FeedV2Event,
  options: {
    content?: string;
    customPlaceholders: MediumDetails["customPlaceholders"];
    embeds?: Array<{
      title?: string;
      description?: string;
      [key: string]: unknown;
    }>;
  }
): FeedV2Event {
  // Build embeds with default null values for required fields
  const embeds = options.embeds?.map((embed) => ({
    title: embed.title ?? null,
    description: embed.description ?? null,
    url: null,
    color: null,
    footer: null,
    image: null,
    thumbnail: null,
    author: null,
    fields: undefined,
    timestamp: null,
  })) as MediumDetails["embeds"] | undefined;

  return {
    ...baseEvent,
    data: {
      ...baseEvent.data,
      mediums: [
        {
          ...baseEvent.data.mediums[0]!,
          details: {
            ...baseEvent.data.mediums[0]!.details,
            content:
              options.content ?? baseEvent.data.mediums[0]!.details.content,
            customPlaceholders: options.customPlaceholders,
            embeds: embeds ?? baseEvent.data.mediums[0]!.details.embeds,
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

describe("Custom Placeholders (e2e)", () => {
  describe("Basic Custom Placeholder Tests", () => {
    it("applies regex replacement in delivered payload", async () => {
      const ctx = createTestContext();

      const eventWithCustom = createEventWithCustomPlaceholders(
        ctx.testFeedV2Event,
        {
          content: "{{custom::modified}}",
          customPlaceholders: [
            {
              id: "1",
              referenceName: "modified",
              sourcePlaceholder: "title",
              steps: [
                {
                  type: CustomPlaceholderStepType.Regex,
                  regexSearch: "Hello",
                  replacementString: "Goodbye",
                },
              ],
            },
          ],
        }
      );

      try {
        await ctx.handleEvent(eventWithCustom);
        ctx.discordClient.clear();

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "regex-test", title: "Hello World" }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithCustom);

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);
        expect(results![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);

        const payload = getDiscordPayload(ctx);
        expect(payload.content).toBe("Goodbye World");
      } finally {
        ctx.cleanup();
      }
    });

    it("supports multiple custom placeholders in same message", async () => {
      const ctx = createTestContext();

      const eventWithCustom = createEventWithCustomPlaceholders(
        ctx.testFeedV2Event,
        {
          content: "Title: {{custom::upper}} | Desc: {{custom::lower}}",
          customPlaceholders: [
            {
              id: "1",
              referenceName: "upper",
              sourcePlaceholder: "title",
              steps: [{ type: CustomPlaceholderStepType.Uppercase }],
            },
            {
              id: "2",
              referenceName: "lower",
              sourcePlaceholder: "description",
              steps: [{ type: CustomPlaceholderStepType.Lowercase }],
            },
          ],
        }
      );

      try {
        await ctx.handleEvent(eventWithCustom);
        ctx.discordClient.clear();

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "multi-test", title: "Hello", description: "WORLD" }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithCustom);

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);

        const payload = getDiscordPayload(ctx);
        expect(payload.content).toBe("Title: HELLO | Desc: world");
      } finally {
        ctx.cleanup();
      }
    });

    it("applies custom placeholders in embed fields", async () => {
      const ctx = createTestContext();

      const eventWithCustom = createEventWithCustomPlaceholders(
        ctx.testFeedV2Event,
        {
          content: "See embed below",
          customPlaceholders: [
            {
              id: "1",
              referenceName: "upperTitle",
              sourcePlaceholder: "title",
              steps: [{ type: CustomPlaceholderStepType.Uppercase }],
            },
          ],
          embeds: [
            {
              title: "{{custom::upperTitle}}",
              description: "Original: {{title}}",
            },
          ],
        }
      );

      try {
        await ctx.handleEvent(eventWithCustom);
        ctx.discordClient.clear();

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "embed-test", title: "Hello World" }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithCustom);

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);

        const payload = getDiscordPayload(ctx);
        expect(payload.embeds).toBeDefined();
        expect(payload.embeds[0].title).toBe("HELLO WORLD");
        expect(payload.embeds[0].description).toBe("Original: Hello World");
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Step Type Combination Tests", () => {
    it("chains regex + uppercase steps", async () => {
      const ctx = createTestContext();

      const eventWithCustom = createEventWithCustomPlaceholders(
        ctx.testFeedV2Event,
        {
          content: "{{custom::extracted}}",
          customPlaceholders: [
            {
              id: "1",
              referenceName: "extracted",
              sourcePlaceholder: "title",
              steps: [
                {
                  type: CustomPlaceholderStepType.Regex,
                  regexSearch: ".*:\\s*(.*)",
                  replacementString: "$1",
                },
                { type: CustomPlaceholderStepType.Uppercase },
              ],
            },
          ],
        }
      );

      try {
        await ctx.handleEvent(eventWithCustom);
        ctx.discordClient.clear();

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "chain-test", title: "Category: important news" }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithCustom);

        expect(results).not.toBeNull();
        const payload = getDiscordPayload(ctx);
        expect(payload.content).toBe("IMPORTANT NEWS");
      } finally {
        ctx.cleanup();
      }
    });

    it("chains regex + urlEncode steps", async () => {
      const ctx = createTestContext();

      const eventWithCustom = createEventWithCustomPlaceholders(
        ctx.testFeedV2Event,
        {
          content: "https://search.example.com?q={{custom::encoded}}",
          customPlaceholders: [
            {
              id: "1",
              referenceName: "encoded",
              sourcePlaceholder: "title",
              steps: [
                {
                  type: CustomPlaceholderStepType.Regex,
                  regexSearch: "\\[(.+?)\\].*",
                  replacementString: "$1",
                },
                { type: CustomPlaceholderStepType.UrlEncode },
              ],
            },
          ],
        }
      );

      try {
        await ctx.handleEvent(eventWithCustom);
        ctx.discordClient.clear();

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "url-test", title: "[Hello World] - News Article" }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithCustom);

        expect(results).not.toBeNull();
        const payload = getDiscordPayload(ctx);
        expect(payload.content).toBe(
          "https://search.example.com?q=Hello%20World"
        );
      } finally {
        ctx.cleanup();
      }
    });

    it("chains lowercase + regex steps", async () => {
      const ctx = createTestContext();

      const eventWithCustom = createEventWithCustomPlaceholders(
        ctx.testFeedV2Event,
        {
          content: "{{custom::normalized}}",
          customPlaceholders: [
            {
              id: "1",
              referenceName: "normalized",
              sourcePlaceholder: "title",
              steps: [
                { type: CustomPlaceholderStepType.Lowercase },
                {
                  type: CustomPlaceholderStepType.Regex,
                  regexSearch: "breaking:",
                  replacementString: "",
                  regexSearchFlags: "gi",
                },
              ],
            },
          ],
        }
      );

      try {
        await ctx.handleEvent(eventWithCustom);
        ctx.discordClient.clear();

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "lower-regex-test",
                title: "BREAKING: Major Event Happening",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithCustom);

        expect(results).not.toBeNull();
        const payload = getDiscordPayload(ctx);
        expect(payload.content).toBe("major event happening");
      } finally {
        ctx.cleanup();
      }
    });

    it("formats dates with timezone using dateFormat step", async () => {
      const ctx = createTestContext();

      const eventWithCustom = createEventWithCustomPlaceholders(
        ctx.testFeedV2Event,
        {
          content: "Published: {{custom::formattedDate}}",
          customPlaceholders: [
            {
              id: "1",
              referenceName: "formattedDate",
              sourcePlaceholder: "pubDate",
              steps: [
                {
                  type: CustomPlaceholderStepType.DateFormat,
                  format: "YYYY-MM-DD HH:mm",
                  timezone: "America/New_York",
                },
              ],
            },
          ],
        }
      );

      try {
        await ctx.handleEvent(eventWithCustom);
        ctx.discordClient.clear();

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "date-test",
                title: "News",
                pubDate: "2023-06-15T14:30:00Z",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithCustom);

        expect(results).not.toBeNull();
        const payload = getDiscordPayload(ctx);
        // 14:30 UTC = 10:30 EDT (summer time in New York)
        expect(payload.content).toBe("Published: 2023-06-15 10:30");
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Edge Cases and Robustness", () => {
    it("outputs empty string when source placeholder is missing", async () => {
      const ctx = createTestContext();

      const eventWithCustom = createEventWithCustomPlaceholders(
        ctx.testFeedV2Event,
        {
          content: "Value: [{{custom::missing}}]",
          customPlaceholders: [
            {
              id: "1",
              referenceName: "missing",
              sourcePlaceholder: "nonexistentField",
              steps: [{ type: CustomPlaceholderStepType.Uppercase }],
            },
          ],
        }
      );

      try {
        await ctx.handleEvent(eventWithCustom);
        ctx.discordClient.clear();

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "missing-test", title: "Hello" }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithCustom);

        expect(results).not.toBeNull();
        const payload = getDiscordPayload(ctx);
        expect(payload.content).toBe("Value: []");
      } finally {
        ctx.cleanup();
      }
    });

    it("preserves original value when regex matches nothing", async () => {
      const ctx = createTestContext();

      const eventWithCustom = createEventWithCustomPlaceholders(
        ctx.testFeedV2Event,
        {
          content: "{{custom::unchanged}}",
          customPlaceholders: [
            {
              id: "1",
              referenceName: "unchanged",
              sourcePlaceholder: "title",
              steps: [
                {
                  type: CustomPlaceholderStepType.Regex,
                  regexSearch: "PATTERN_THAT_WONT_MATCH",
                  replacementString: "REPLACED",
                },
              ],
            },
          ],
        }
      );

      try {
        await ctx.handleEvent(eventWithCustom);
        ctx.discordClient.clear();

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "nomatch-test", title: "Original Title" }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithCustom);

        expect(results).not.toBeNull();
        const payload = getDiscordPayload(ctx);
        expect(payload.content).toBe("Original Title");
      } finally {
        ctx.cleanup();
      }
    });

    it("chains multiple regex steps for complex transformations", async () => {
      const ctx = createTestContext();

      const eventWithCustom = createEventWithCustomPlaceholders(
        ctx.testFeedV2Event,
        {
          content: "{{custom::cleaned}}",
          customPlaceholders: [
            {
              id: "1",
              referenceName: "cleaned",
              sourcePlaceholder: "title",
              steps: [
                // Step 1: Remove brackets and content
                {
                  type: CustomPlaceholderStepType.Regex,
                  regexSearch: "\\[.*?\\]",
                  replacementString: "",
                },
                // Step 2: Remove leading/trailing whitespace artifacts
                {
                  type: CustomPlaceholderStepType.Regex,
                  regexSearch: "^\\s+|\\s+$",
                  replacementString: "",
                },
                // Step 3: Collapse multiple spaces
                {
                  type: CustomPlaceholderStepType.Regex,
                  regexSearch: "\\s+",
                  replacementString: " ",
                },
              ],
            },
          ],
        }
      );

      try {
        await ctx.handleEvent(eventWithCustom);
        ctx.discordClient.clear();

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "multi-regex-test",
                title: "[Breaking]  Important   [Update]  News",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithCustom);

        expect(results).not.toBeNull();
        const payload = getDiscordPayload(ctx);
        expect(payload.content).toBe("Important News");
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Integration with Other Features", () => {
    it("applies custom placeholders to HTML-converted content", async () => {
      const ctx = createTestContext();

      const eventWithCustom = createEventWithCustomPlaceholders(
        ctx.testFeedV2Event,
        {
          content: "{{custom::processed}}",
          customPlaceholders: [
            {
              id: "1",
              referenceName: "processed",
              sourcePlaceholder: "description",
              steps: [
                // After HTML -> markdown conversion, extract text between ** (bold markers)
                {
                  type: CustomPlaceholderStepType.Regex,
                  regexSearch: "\\*\\*(.+?)\\*\\*",
                  replacementString: "BOLD:$1",
                },
              ],
            },
          ],
        }
      );

      try {
        await ctx.handleEvent(eventWithCustom);
        ctx.discordClient.clear();

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "html-test",
                title: "News",
                description: "<strong>Important</strong> announcement",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithCustom);

        expect(results).not.toBeNull();
        const payload = getDiscordPayload(ctx);
        // HTML <strong> should be converted to ** before custom placeholder runs
        expect(payload.content).toBe("BOLD:Important announcement");
      } finally {
        ctx.cleanup();
      }
    });
  });
});

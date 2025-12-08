import { describe, it, expect } from "bun:test";
import { randomUUID } from "crypto";
import { ArticleDeliveryStatus } from "../src/delivery";
import { CustomPlaceholderStepType } from "../src/shared/constants";
import getTestRssFeed from "./data/test-rss-feed";
import { createTestContext } from "./helpers/test-context";
import type { FeedV2Event } from "../src/shared/schemas";

// Note: Test infrastructure setup/teardown is handled by test/setup.ts (preload file)

type MediumDetails = FeedV2Event["data"]["mediums"][0]["details"];

/**
 * Helper to create a feed event with placeholder options configured on the medium.
 */
function createEventWithPlaceholderOptions(
  baseEvent: FeedV2Event,
  options: {
    content?: string;
    placeholderLimits?: Array<{
      placeholder: string;
      characterCount: number;
      appendString?: string | null;
    }> | null;
    enablePlaceholderFallback?: boolean;
    embeds?: Array<{
      title?: string | null;
      description?: string | null;
      [key: string]: unknown;
    }>;
    customPlaceholders?: MediumDetails["customPlaceholders"];
    formatOptions?: {
      dateFormat?: string;
      dateTimezone?: string;
    };
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
      feed: {
        ...baseEvent.data.feed,
        formatOptions: options.formatOptions,
      },
      mediums: [
        {
          ...baseEvent.data.mediums[0]!,
          details: {
            ...baseEvent.data.mediums[0]!.details,
            content:
              options.content ?? baseEvent.data.mediums[0]!.details.content,
            placeholderLimits: options.placeholderLimits
              ? options.placeholderLimits.map((pl) => ({
                  placeholder: pl.placeholder,
                  characterCount: pl.characterCount,
                  appendString: pl.appendString ?? null,
                }))
              : null,
            enablePlaceholderFallback:
              options.enablePlaceholderFallback ?? false,
            embeds: embeds ?? baseEvent.data.mediums[0]!.details.embeds,
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
  expect(ctx.discordClient.capturedPayloads.length).toBeGreaterThan(0);
  return JSON.parse(
    ctx.discordClient.capturedPayloads[0]!.options.body as string
  );
}

describe("Placeholder Options (e2e)", () => {
  describe("Placeholder Limits", () => {
    it("truncates placeholder to characterCount", async () => {
      const ctx = createTestContext();

      const eventWithLimits = createEventWithPlaceholderOptions(
        ctx.testFeedV2Event,
        {
          content: "{{description}}",
          placeholderLimits: [
            {
              placeholder: "description",
              characterCount: 20,
            },
          ],
        }
      );

      try {
        await ctx.seedArticles(eventWithLimits);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "truncate-test",
                title: "Test",
                description:
                  "This is a very long description that should be truncated",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithLimits);

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);
        expect(results![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);

        const payload = getDiscordPayload(ctx);
        // applySplit truncates at word boundaries, so 20 char limit gives us 19 chars
        // ("This is a very long" without trailing space)
        expect(payload.content.length).toBeLessThanOrEqual(20);
        expect(payload.content).toBe("This is a very long");
      } finally {
        ctx.cleanup();
      }
    });

    it("appends appendString when truncated", async () => {
      const ctx = createTestContext();

      const eventWithLimits = createEventWithPlaceholderOptions(
        ctx.testFeedV2Event,
        {
          content: "{{description}}",
          placeholderLimits: [
            {
              placeholder: "description",
              characterCount: 25,
              appendString: "...",
            },
          ],
        }
      );

      try {
        await ctx.seedArticles(eventWithLimits);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "append-string-test",
                title: "Test",
                description: "This is a long description that needs truncation",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithLimits);

        expect(results).not.toBeNull();

        const payload = getDiscordPayload(ctx);
        // Should be truncated with ... appended
        expect(payload.content).toMatch(/\.\.\.$/);
        expect(payload.content.length).toBeLessThanOrEqual(25);
      } finally {
        ctx.cleanup();
      }
    });

    it("applies different limits to different placeholders", async () => {
      const ctx = createTestContext();

      const eventWithLimits = createEventWithPlaceholderOptions(
        ctx.testFeedV2Event,
        {
          content: "Title: {{title}} | Desc: {{description}}",
          placeholderLimits: [
            {
              placeholder: "title",
              characterCount: 10,
              appendString: "~",
            },
            {
              placeholder: "description",
              characterCount: 15,
              appendString: "...",
            },
          ],
        }
      );

      try {
        await ctx.seedArticles(eventWithLimits);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "multi-limit-test",
                title: "This is a very long title",
                description: "This is a very long description text",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithLimits);

        expect(results).not.toBeNull();

        const payload = getDiscordPayload(ctx);
        // applySplit truncates at word boundaries within character limits
        // Title: "This is a very long title" with limit 10 + "~" → "This is~"
        // Description: "This is a very long description text" with limit 15 + "..." → "This is a..."
        expect(payload.content).toContain("Title: This is~");
        expect(payload.content).toContain("Desc: This is a...");
      } finally {
        ctx.cleanup();
      }
    });

    it("appendString can contain placeholders", async () => {
      const ctx = createTestContext();

      const eventWithLimits = createEventWithPlaceholderOptions(
        ctx.testFeedV2Event,
        {
          content: "{{description}}",
          placeholderLimits: [
            {
              placeholder: "description",
              characterCount: 20,
              appendString: " [{{title}}]",
            },
          ],
          enablePlaceholderFallback: true,
        }
      );

      try {
        await ctx.seedArticles(eventWithLimits);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "nested-placeholder",
                title: "MORE",
                description:
                  "This is a long description that will be truncated",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithLimits);

        expect(results).not.toBeNull();

        const payload = getDiscordPayload(ctx);
        // appendString should resolve {{title}} to "MORE"
        expect(payload.content).toContain("[MORE]");
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Placeholder Fallback", () => {
    it("uses fallback when primary is empty", async () => {
      const ctx = createTestContext();

      // Test fallback from missing field to real RSS field (title)
      const eventWithFallback = createEventWithPlaceholderOptions(
        ctx.testFeedV2Event,
        {
          content: "Value: {{missing||title}}",
          enablePlaceholderFallback: true,
        }
      );

      try {
        await ctx.seedArticles(eventWithFallback);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "fallback-test",
                title: "Fallback Title Value",
                // 'missing' field is not provided, should fall back to title
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithFallback);

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);

        const payload = getDiscordPayload(ctx);
        expect(payload.content).toBe("Value: Fallback Title Value");
      } finally {
        ctx.cleanup();
      }
    });

    it("supports text:: literal fallback", async () => {
      const ctx = createTestContext();

      const eventWithFallback = createEventWithPlaceholderOptions(
        ctx.testFeedV2Event,
        {
          content: "Value: {{missing||text::Default Text}}",
          enablePlaceholderFallback: true,
        }
      );

      try {
        await ctx.seedArticles(eventWithFallback);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "literal-fallback",
                title: "Test",
                // 'missing' field is not provided
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithFallback);

        expect(results).not.toBeNull();

        const payload = getDiscordPayload(ctx);
        expect(payload.content).toBe("Value: Default Text");
      } finally {
        ctx.cleanup();
      }
    });

    it("chains multiple fallbacks", async () => {
      const ctx = createTestContext();

      // Chain fallback from missing fields to title (last one that exists)
      const eventWithFallback = createEventWithPlaceholderOptions(
        ctx.testFeedV2Event,
        {
          content: "Value: {{first||second||title}}",
          enablePlaceholderFallback: true,
        }
      );

      try {
        await ctx.seedArticles(eventWithFallback);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "chain-fallback",
                title: "Chain Fallback Title",
                // 'first' and 'second' are not standard RSS fields, so fallback to title
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithFallback);

        expect(results).not.toBeNull();

        const payload = getDiscordPayload(ctx);
        expect(payload.content).toBe("Value: Chain Fallback Title");
      } finally {
        ctx.cleanup();
      }
    });

    it("fallback works in embeds", async () => {
      const ctx = createTestContext();

      const eventWithFallback = createEventWithPlaceholderOptions(
        ctx.testFeedV2Event,
        {
          content: "See embed",
          enablePlaceholderFallback: true,
          embeds: [
            {
              title: "{{customTitle||title}}",
              description: "{{summary||description||text::No description}}",
            },
          ],
        }
      );

      try {
        await ctx.seedArticles(eventWithFallback);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "embed-fallback",
                title: "Article Title",
                // 'customTitle' and 'summary' are not provided
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithFallback);

        expect(results).not.toBeNull();

        const payload = getDiscordPayload(ctx);
        expect(payload.embeds).toBeDefined();
        expect(payload.embeds[0].title).toBe("Article Title");
        expect(payload.embeds[0].description).toBe("No description");
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Integration Tests", () => {
    it("format options work with custom placeholders", async () => {
      const ctx = createTestContext();

      const eventWithIntegration = createEventWithPlaceholderOptions(
        ctx.testFeedV2Event,
        {
          content: "Date: {{custom::formattedDate}}",
          formatOptions: {
            dateFormat: "YYYY-MM-DD",
            dateTimezone: "UTC",
          },
          customPlaceholders: [
            {
              id: "1",
              referenceName: "formattedDate",
              sourcePlaceholder: "pubdate",
              steps: [{ type: CustomPlaceholderStepType.Uppercase }],
            },
          ],
        }
      );

      try {
        await ctx.seedArticles(eventWithIntegration);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "format-custom-test",
                title: "Test",
                pubDate: "2023-06-15T14:30:00Z",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithIntegration);

        expect(results).not.toBeNull();

        const payload = getDiscordPayload(ctx);
        // Date should be formatted and uppercased (though dates are already uppercase)
        expect(payload.content).toBe("Date: 2023-06-15");
      } finally {
        ctx.cleanup();
      }
    });

    it("placeholder limits work with fallback syntax", async () => {
      const ctx = createTestContext();

      // When using fallback syntax, the limit must match the full accessor
      // e.g., placeholder: "missing||description" matches {{missing||description}}
      const eventWithIntegration = createEventWithPlaceholderOptions(
        ctx.testFeedV2Event,
        {
          content: "{{missing||description}}",
          enablePlaceholderFallback: true,
          placeholderLimits: [
            {
              // The limit key must match the full accessor including fallback syntax
              placeholder: "missing||description",
              characterCount: 20,
              appendString: "...",
            },
          ],
        }
      );

      try {
        await ctx.seedArticles(eventWithIntegration);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "limit-fallback-test",
                title: "Test",
                description:
                  "This is a very long description that should be truncated after falling back",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithIntegration);

        expect(results).not.toBeNull();

        const payload = getDiscordPayload(ctx);
        // Should fall back to description, then truncate with word boundary
        // "This is a very long" = 19 chars + "..." = 22 chars total, but limit is 20
        // So it truncates further: "This is a..." (12 chars)
        expect(payload.content.length).toBeLessThanOrEqual(20);
        expect(payload.content).toMatch(/\.\.\.$/);
      } finally {
        ctx.cleanup();
      }
    });
  });
});

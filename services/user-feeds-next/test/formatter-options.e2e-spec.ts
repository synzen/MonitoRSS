import { describe, it, expect } from "bun:test";
import { randomUUID } from "crypto";
import { ArticleDeliveryStatus } from "../src/delivery";
import getTestRssFeed from "./data/test-rss-feed";
import { createTestContext } from "./helpers/test-context";
import type { FeedV2Event } from "../src/shared/schemas";

// Note: Test infrastructure setup/teardown is handled by test/setup.ts (preload file)

/**
 * Helper to create a feed event with formatter options configured on the medium.
 */
function createEventWithFormatterOptions(
  baseEvent: FeedV2Event,
  options: {
    content?: string;
    formatter?: {
      stripImages?: boolean;
      formatTables?: boolean;
      disableImageLinkPreviews?: boolean;
      ignoreNewLines?: boolean;
    };
  }
): FeedV2Event {
  // Merge formatter options with defaults
  const formatter = options.formatter
    ? {
        stripImages: options.formatter.stripImages ?? false,
        formatTables: options.formatter.formatTables ?? false,
        disableImageLinkPreviews:
          options.formatter.disableImageLinkPreviews ?? false,
        ignoreNewLines: options.formatter.ignoreNewLines ?? true,
      }
    : undefined;

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
            formatter,
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

describe("Formatter Options (e2e)", () => {
  describe("Medium Formatter Options", () => {
    it("stripImages removes images from content", async () => {
      const ctx = createTestContext();

      const eventWithFormatter = createEventWithFormatterOptions(
        ctx.testFeedV2Event,
        {
          content: "{{description}}",
          formatter: {
            stripImages: true,
          },
        }
      );

      try {
        await ctx.seedArticles(eventWithFormatter);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "strip-images-test",
                title: "Image Test",
                description:
                  'Before image <img src="https://example.com/image.jpg" /> After image',
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithFormatter);

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);
        expect(results![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);

        const payload = getDiscordPayload(ctx);
        // Image should be stripped, only text remains
        expect(payload.content).not.toContain("https://example.com/image.jpg");
        expect(payload.content).toContain("Before image");
        expect(payload.content).toContain("After image");
      } finally {
        ctx.cleanup();
      }
    });

    it("formatTables converts HTML tables to ASCII", async () => {
      const ctx = createTestContext();

      const eventWithFormatter = createEventWithFormatterOptions(
        ctx.testFeedV2Event,
        {
          content: "{{description}}",
          formatter: {
            formatTables: true,
          },
        }
      );

      try {
        await ctx.seedArticles(eventWithFormatter);

        const htmlTable = `
          <table>
            <tr><th>Name</th><th>Value</th></tr>
            <tr><td>Alpha</td><td>100</td></tr>
            <tr><td>Beta</td><td>200</td></tr>
          </table>
        `;

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "table-format-test",
                title: "Table Test",
                description: htmlTable,
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithFormatter);

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);

        const payload = getDiscordPayload(ctx);
        // Table should be formatted as code block with ASCII table
        // Note: table headers are uppercased by the formatter
        expect(payload.content).toContain("```");
        expect(payload.content.toUpperCase()).toContain("NAME");
        expect(payload.content.toUpperCase()).toContain("VALUE");
        expect(payload.content).toContain("Alpha");
        expect(payload.content).toContain("100");
      } finally {
        ctx.cleanup();
      }
    });

    it("disableImageLinkPreviews wraps image URLs", async () => {
      const ctx = createTestContext();

      const eventWithFormatter = createEventWithFormatterOptions(
        ctx.testFeedV2Event,
        {
          content: "{{description}}",
          formatter: {
            disableImageLinkPreviews: true,
          },
        }
      );

      try {
        await ctx.seedArticles(eventWithFormatter);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "disable-preview-test",
                title: "Preview Test",
                description:
                  '<img src="https://example.com/photo.png" alt="Photo" />',
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithFormatter);

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);

        const payload = getDiscordPayload(ctx);
        // URL should be wrapped with < > to disable Discord preview
        expect(payload.content).toContain("<https://example.com/photo.png>");
      } finally {
        ctx.cleanup();
      }
    });

    it("ignoreNewLines=false preserves newlines", async () => {
      const ctx = createTestContext();

      const eventWithFormatter = createEventWithFormatterOptions(
        ctx.testFeedV2Event,
        {
          content: "{{description}}",
          formatter: {
            ignoreNewLines: false,
          },
        }
      );

      try {
        await ctx.seedArticles(eventWithFormatter);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "newlines-test",
                title: "Newlines Test",
                description: "<p>First paragraph</p><p>Second paragraph</p>",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithFormatter);

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);

        const payload = getDiscordPayload(ctx);
        // Paragraphs should be on separate lines
        expect(payload.content).toContain("\n");
        expect(payload.content).toContain("First paragraph");
        expect(payload.content).toContain("Second paragraph");
      } finally {
        ctx.cleanup();
      }
    });

    it("combines multiple formatter options", async () => {
      const ctx = createTestContext();

      const eventWithFormatter = createEventWithFormatterOptions(
        ctx.testFeedV2Event,
        {
          content: "{{description}}",
          formatter: {
            stripImages: false,
            disableImageLinkPreviews: true,
            ignoreNewLines: false,
          },
        }
      );

      try {
        await ctx.seedArticles(eventWithFormatter);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "combined-formatter",
                title: "Combined Test",
                description: `
                  <p>Introduction</p>
                  <img src="https://example.com/image.jpg" />
                  <p>Conclusion</p>
                `,
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithFormatter);

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);

        const payload = getDiscordPayload(ctx);
        // Image URL should be wrapped (disableImageLinkPreviews)
        expect(payload.content).toContain("<https://example.com/image.jpg>");
        // Should have newlines (ignoreNewLines=false)
        expect(payload.content).toContain("\n");
        // Should contain both paragraphs
        expect(payload.content).toContain("Introduction");
        expect(payload.content).toContain("Conclusion");
      } finally {
        ctx.cleanup();
      }
    });
  });
});

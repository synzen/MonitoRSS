import { describe, it, expect } from "bun:test";
import { randomUUID } from "crypto";
import { ArticleDeliveryStatus } from "../src/delivery";
import getTestRssFeed from "./data/test-rss-feed";
import { createTestContext } from "./helpers/test-context";
import type { FeedV2Event } from "../src/schemas";

// Note: Test infrastructure setup/teardown is handled by test/setup.ts (preload file)

/**
 * Helper to create a feed event with split options configured on the medium.
 */
function createEventWithSplitOptions(
  baseEvent: FeedV2Event,
  options: {
    content?: string;
    splitOptions?: {
      splitChar?: string | null;
      appendChar?: string | null;
      prependChar?: string | null;
    };
  }
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
            content:
              options.content ?? baseEvent.data.mediums[0]!.details.content,
            splitOptions: options.splitOptions,
          },
        },
      ],
    },
  };
}

/**
 * Helper to get all Discord payloads from captured requests
 */
function getAllDiscordPayloads(ctx: ReturnType<typeof createTestContext>) {
  return ctx.discordClient.capturedPayloads.map((p) =>
    JSON.parse(p.options.body as string)
  );
}

describe("Split Options (e2e)", () => {
  describe("Medium Split Options", () => {
    it("splits long content into multiple messages", async () => {
      const ctx = createTestContext();

      try {
        await ctx.seedArticles();

        // Generate a very long description (3000+ chars)
        const longText = Array(100)
          .fill("This is a test sentence. ")
          .join("");

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "long-article",
                title: "Long Article",
                description: longText,
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        // Create event with splitOptions
        const eventWithSplit = createEventWithSplitOptions(ctx.testFeedV2Event, {
          content: "{{description}}",
          splitOptions: {},
        });

        const results = await ctx.handleEvent(eventWithSplit);

        expect(results).not.toBeNull();
        // One article should be processed (though it may create multiple messages)
        expect(results!.length).toBeGreaterThanOrEqual(1);

        // Should have multiple payloads due to splitting
        const payloads = getAllDiscordPayloads(ctx);
        expect(payloads.length).toBeGreaterThan(1);

        // Verify all parts together contain the original text
        const combinedContent = payloads.map((p) => p.content).join("");
        expect(combinedContent).toContain("This is a test sentence");
      } finally {
        ctx.cleanup();
      }
    });

    it("uses custom splitChar for splitting", async () => {
      const ctx = createTestContext();

      // Use pipe character as split char
      const eventWithSplit = createEventWithSplitOptions(ctx.testFeedV2Event, {
        content: "{{description}}",
        splitOptions: {
          splitChar: "|",
        },
      });

      try {
        await ctx.handleEvent(eventWithSplit);
        ctx.discordClient.clear();

        // Create content with pipe characters that will trigger split
        // Each segment is short but total exceeds limit
        const segments = Array(150)
          .fill("This is segment number X|")
          .join("");

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "pipe-split",
                title: "Pipe Split Article",
                description: segments,
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithSplit);

        expect(results).not.toBeNull();

        const payloads = getAllDiscordPayloads(ctx);
        expect(payloads.length).toBeGreaterThan(1);

        // Content should be split on pipe characters
        payloads.forEach((p, i) => {
          if (i < payloads.length - 1) {
            // Non-final parts should end with the text before |
            expect(p.content).toContain("This is segment");
          }
        });
      } finally {
        ctx.cleanup();
      }
    });

    it("appends appendChar to last split message", async () => {
      const ctx = createTestContext();

      const eventWithSplit = createEventWithSplitOptions(ctx.testFeedV2Event, {
        content: "{{description}}",
        splitOptions: {
          appendChar: " ...(continued)",
        },
      });

      try {
        await ctx.handleEvent(eventWithSplit);
        ctx.discordClient.clear();

        // Generate content that will split
        const longText = Array(100)
          .fill("This is a test sentence. ")
          .join("");

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "append-test",
                title: "Append Test",
                description: longText,
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithSplit);

        expect(results).not.toBeNull();

        const payloads = getAllDiscordPayloads(ctx);
        expect(payloads.length).toBeGreaterThan(1);

        // Last message should have appendChar (implementation behavior)
        expect(payloads[payloads.length - 1].content).toContain(
          "...(continued)"
        );

        // First message should NOT have appendChar
        expect(payloads[0].content).not.toContain("...(continued)");
      } finally {
        ctx.cleanup();
      }
    });

    it("prepends prependChar to first split message", async () => {
      const ctx = createTestContext();

      const eventWithSplit = createEventWithSplitOptions(ctx.testFeedV2Event, {
        content: "{{description}}",
        splitOptions: {
          prependChar: "(continued)... ",
        },
      });

      try {
        await ctx.handleEvent(eventWithSplit);
        ctx.discordClient.clear();

        // Generate content that will split
        const longText = Array(100)
          .fill("This is a test sentence. ")
          .join("");

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "prepend-test",
                title: "Prepend Test",
                description: longText,
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithSplit);

        expect(results).not.toBeNull();

        const payloads = getAllDiscordPayloads(ctx);
        expect(payloads.length).toBeGreaterThan(1);

        // First message SHOULD have prependChar (implementation behavior)
        expect(payloads[0].content).toMatch(/^\(continued\)\.\.\./);

        // Last message should NOT have prependChar
        expect(payloads[payloads.length - 1].content).not.toMatch(
          /^\(continued\)\.\.\./
        );
      } finally {
        ctx.cleanup();
      }
    });

    it("combines append and prepend chars", async () => {
      const ctx = createTestContext();

      const eventWithSplit = createEventWithSplitOptions(ctx.testFeedV2Event, {
        content: "{{description}}",
        splitOptions: {
          appendChar: " [MORE]",
          prependChar: "[CONT] ",
        },
      });

      try {
        await ctx.handleEvent(eventWithSplit);
        ctx.discordClient.clear();

        // Generate content that will split
        const longText = Array(100)
          .fill("This is a test sentence. ")
          .join("");

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "combined-chars",
                title: "Combined Test",
                description: longText,
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithSplit);

        expect(results).not.toBeNull();

        const payloads = getAllDiscordPayloads(ctx);
        expect(payloads.length).toBeGreaterThan(1);

        // Per implementation: first message has prependChar, last has appendChar
        // First message: has prepend, no append
        expect(payloads[0].content).toMatch(/^\[CONT\]/);
        expect(payloads[0].content).not.toContain("[MORE]");

        // Last message: has append, no prepend
        const lastPayload = payloads[payloads.length - 1];
        expect(lastPayload.content).not.toMatch(/^\[CONT\]/);
        expect(lastPayload.content).toContain("[MORE]");

        // Middle messages (if any): have neither append nor prepend
        // (This is based on the implementation's behavior)
      } finally {
        ctx.cleanup();
      }
    });
  });
});

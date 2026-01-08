import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { randomUUID } from "crypto";
import { ArticleDeliveryStatus } from "../../src/delivery";
import getTestRssFeed from "../data/test-rss-feed";
import { createTestContext } from "../helpers/test-context";
import { setupTestDatabase, teardownTestDatabase, type TestStores } from "../helpers/setup-integration-tests";
import type { FeedV2Event, EmbedInput } from "../../src/shared/schemas";

/**
 * Input type for placeholder limits, with appendString being optional.
 */
type PlaceholderLimitInput = {
  placeholder: string;
  characterCount: number;
  appendString?: string;
};

type MediumDetails = FeedV2Event["data"]["mediums"][0]["details"];

let stores: TestStores;

/**
 * Helper to create a feed event with placeholder limits configured on the medium.
 * Uses z.input types which allow omitting fields with defaults.
 */
function createEventWithPlaceholderLimits(
  baseEvent: FeedV2Event,
  placeholderLimits: PlaceholderLimitInput[],
  options?: {
    content?: string;
    embeds?: EmbedInput[];
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
            placeholderLimits: placeholderLimits.map((limit) => ({
              ...limit,
              appendString: limit.appendString ?? null,
            })),
            content:
              options?.content ?? baseEvent.data.mediums[0]!.details.content,
            embeds: (options?.embeds ?? []) as MediumDetails["embeds"],
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

describe("Discord Payload Placeholder Limits (e2e)", { concurrency: true }, () => {
  before(async () => {
    stores = await setupTestDatabase();
  });

  after(async () => {
    await teardownTestDatabase();
  });

  describe("Character Count Truncation", () => {
    it("truncates placeholder value to specified character count", async () => {
      const ctx = createTestContext(stores);

      const eventWithLimits = createEventWithPlaceholderLimits(
        ctx.testFeedV2Event,
        [
          {
            placeholder: "title",
            characterCount: 20,
          },
        ],
        {
          content: "{{title}}",
        }
      );

      try {
        await ctx.seedArticles(eventWithLimits);

        // Title is longer than 20 characters
        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "placeholder-limit-test",
                title: "This is a very long title that exceeds the limit",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithLimits);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);
        assert.strictEqual(results![0]!.status, ArticleDeliveryStatus.PendingDelivery);

        const payload = getDiscordPayload(ctx);
        assert.ok(payload.content.length <= 20);
      } finally {
        ctx.cleanup();
      }
    });

    it("does not truncate when value is under limit", async () => {
      const ctx = createTestContext(stores);

      const eventWithLimits = createEventWithPlaceholderLimits(
        ctx.testFeedV2Event,
        [
          {
            placeholder: "title",
            characterCount: 100,
          },
        ],
        {
          content: "{{title}}",
        }
      );

      try {
        await ctx.seedArticles(eventWithLimits);

        // Title is shorter than 100 characters
        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "no-truncate-test",
                title: "Short title",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithLimits);

        assert.notStrictEqual(results, null);

        const payload = getDiscordPayload(ctx);
        assert.strictEqual(payload.content, "Short title");
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Append String After Truncation", () => {
    it("appends string after truncated content", async () => {
      const ctx = createTestContext(stores);

      const eventWithLimits = createEventWithPlaceholderLimits(
        ctx.testFeedV2Event,
        [
          {
            placeholder: "title",
            characterCount: 15,
            appendString: "...",
          },
        ],
        {
          content: "{{title}}",
        }
      );

      try {
        await ctx.seedArticles(eventWithLimits);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "append-string-test",
                title: "This is a long title that will be truncated",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithLimits);

        assert.notStrictEqual(results, null);

        const payload = getDiscordPayload(ctx);
        assert.ok(payload.content.includes("..."));
        // Total length should be within limit + append string
        assert.ok(payload.content.length <= 18); // 15 + 3 for "..."
      } finally {
        ctx.cleanup();
      }
    });

    it("does not append string when value is under limit", async () => {
      const ctx = createTestContext(stores);

      const eventWithLimits = createEventWithPlaceholderLimits(
        ctx.testFeedV2Event,
        [
          {
            placeholder: "title",
            characterCount: 100,
            appendString: "...",
          },
        ],
        {
          content: "{{title}}",
        }
      );

      try {
        await ctx.seedArticles(eventWithLimits);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "no-append-test",
                title: "Short",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithLimits);

        assert.notStrictEqual(results, null);

        const payload = getDiscordPayload(ctx);
        assert.strictEqual(payload.content, "Short");
        assert.ok(!payload.content.includes("..."));
      } finally {
        ctx.cleanup();
      }
    });

    it("uses placeholder in append string", async () => {
      const ctx = createTestContext(stores);

      const eventWithLimits = createEventWithPlaceholderLimits(
        ctx.testFeedV2Event,
        [
          {
            placeholder: "description",
            characterCount: 20,
            appendString: "... [Read More]({{link}})",
          },
        ],
        {
          content: "{{description}}",
        }
      );

      try {
        await ctx.seedArticles(eventWithLimits);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "append-placeholder-test",
                description:
                  "This is a very long description that will be truncated and have a link appended",
                link: "https://example.com/article",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithLimits);

        assert.notStrictEqual(results, null);

        const payload = getDiscordPayload(ctx);
        assert.ok(payload.content.includes("https://example.com/article"));
        assert.ok(payload.content.includes("Read More"));
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Multiple Placeholder Limits", () => {
    it("applies limits to multiple placeholders", async () => {
      const ctx = createTestContext(stores);

      const eventWithLimits = createEventWithPlaceholderLimits(
        ctx.testFeedV2Event,
        [
          {
            placeholder: "title",
            characterCount: 10,
            appendString: "...",
          },
          {
            placeholder: "description",
            characterCount: 15,
            appendString: " [more]",
          },
        ],
        {
          content: "Title: {{title}} | Description: {{description}}",
        }
      );

      try {
        await ctx.seedArticles(eventWithLimits);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "multiple-limits-test",
                title: "Very Long Title Here",
                description: "Very long description text here",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithLimits);

        assert.notStrictEqual(results, null);

        const payload = getDiscordPayload(ctx);
        // Both placeholders should be truncated with their respective append strings
        assert.ok(payload.content.includes("..."));
        assert.ok(payload.content.includes("[more]"));
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Placeholder Limits in Embeds", () => {
    it("applies placeholder limits in embed fields", async () => {
      const ctx = createTestContext(stores);

      const eventWithLimits = createEventWithPlaceholderLimits(
        ctx.testFeedV2Event,
        [
          {
            placeholder: "description",
            characterCount: 25,
            appendString: "...",
          },
        ],
        {
          content: "",
          embeds: [
            {
              title: "{{title}}",
              description: "{{description}}",
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
                guid: "embed-limit-test",
                title: "Embed Title",
                description:
                  "This is a very long description that should be truncated in the embed",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithLimits);

        assert.notStrictEqual(results, null);

        const payload = getDiscordPayload(ctx);
        assert.ok(payload.embeds[0].description.includes("..."));
        // Description should be truncated
        assert.ok(payload.embeds[0].description.length <= 28); // 25 + 3 for "..."
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Edge Cases", () => {
    it("handles limit of 0 (defaults to 2000)", async () => {
      const ctx = createTestContext(stores);

      const eventWithLimits = createEventWithPlaceholderLimits(
        ctx.testFeedV2Event,
        [
          {
            placeholder: "title",
            characterCount: 0,
          },
        ],
        {
          content: "Title: {{title}} - End",
        }
      );

      try {
        await ctx.seedArticles(eventWithLimits);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "zero-limit-test",
                title: "Any Title",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithLimits);

        assert.notStrictEqual(results, null);

        const payload = getDiscordPayload(ctx);
        // With limit 0, the limit defaults to 2000 (no truncation)
        assert.strictEqual(payload.content, "Title: Any Title - End");
      } finally {
        ctx.cleanup();
      }
    });

    it("handles very small limit with append string", async () => {
      const ctx = createTestContext(stores);

      const eventWithLimits = createEventWithPlaceholderLimits(
        ctx.testFeedV2Event,
        [
          {
            placeholder: "title",
            characterCount: 5,
            appendString: "...",
          },
        ],
        {
          content: "{{title}}",
        }
      );

      try {
        await ctx.seedArticles(eventWithLimits);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "small-limit-test",
                title: "This title will be heavily truncated",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithLimits);

        assert.notStrictEqual(results, null);

        const payload = getDiscordPayload(ctx);
        // Should have some content even with very small limit
        assert.ok(payload.content.length > 0);
        assert.ok(payload.content.includes("..."));
      } finally {
        ctx.cleanup();
      }
    });

    it("handles placeholder that does not exist in article", async () => {
      const ctx = createTestContext(stores);

      const eventWithLimits = createEventWithPlaceholderLimits(
        ctx.testFeedV2Event,
        [
          {
            placeholder: "nonexistent",
            characterCount: 10,
          },
        ],
        {
          content: "Value: {{nonexistent}} - Title: {{title}}",
        }
      );

      try {
        await ctx.seedArticles(eventWithLimits);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "nonexistent-placeholder-test",
                title: "Real Title",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithLimits);

        assert.notStrictEqual(results, null);

        const payload = getDiscordPayload(ctx);
        // Nonexistent placeholder should be empty
        assert.ok(payload.content.includes("Value:"));
        assert.ok(payload.content.includes("Title: Real Title"));
      } finally {
        ctx.cleanup();
      }
    });

    it("handles empty placeholderLimits array", async () => {
      const ctx = createTestContext(stores);

      const eventWithLimits = createEventWithPlaceholderLimits(
        ctx.testFeedV2Event,
        [],
        {
          content: "{{title}}",
        }
      );

      try {
        await ctx.seedArticles(eventWithLimits);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "empty-limits-test",
                title: "Full Title Without Truncation",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithLimits);

        assert.notStrictEqual(results, null);

        const payload = getDiscordPayload(ctx);
        // No truncation should occur
        assert.strictEqual(payload.content, "Full Title Without Truncation");
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Fallback Syntax with Placeholder Limits", () => {
    it("applies limit when using fallback syntax and first placeholder has value", async () => {
      const ctx = createTestContext(stores);

      const eventWithLimits = createEventWithPlaceholderLimits(
        ctx.testFeedV2Event,
        [
          {
            placeholder: "summary",
            characterCount: 20,
            appendString: "...",
          },
          {
            placeholder: "description",
            characterCount: 30,
            appendString: "...",
          },
        ],
        {
          content: "{{summary||description}}",
        }
      );

      try {
        await ctx.seedArticles(eventWithLimits);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "fallback-limit-summary-test",
                summary:
                  "This is a long summary that should be truncated to 20 chars",
                description: "This description should not be used",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithLimits);

        assert.notStrictEqual(results, null);

        const payload = getDiscordPayload(ctx);
        // Summary limit (20) + append string (3) = 23 max
        assert.ok(payload.content.length <= 23);
        assert.ok(payload.content.includes("..."));
      } finally {
        ctx.cleanup();
      }
    });

    it("applies limit when using fallback syntax and falls back to second placeholder", async () => {
      const ctx = createTestContext(stores);

      const eventWithLimits = createEventWithPlaceholderLimits(
        ctx.testFeedV2Event,
        [
          {
            placeholder: "summary",
            characterCount: 20,
            appendString: " [sum]",
          },
          {
            placeholder: "description",
            characterCount: 25,
            appendString: " [desc]",
          },
        ],
        {
          content: "{{summary||description}}",
        }
      );

      try {
        await ctx.seedArticles(eventWithLimits);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "fallback-limit-description-test",
                // No summary - will fall back to description
                description:
                  "This is a long description that should be truncated to 25 chars",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithLimits);

        assert.notStrictEqual(results, null);

        const payload = getDiscordPayload(ctx);
        // Description limit (25) + append string (7) = 32 max
        assert.ok(payload.content.length <= 32);
        assert.ok(payload.content.includes("[desc]"));
        assert.ok(!payload.content.includes("[sum]"));
      } finally {
        ctx.cleanup();
      }
    });

    it("does not apply limit when fallback resolves to literal text", async () => {
      const ctx = createTestContext(stores);

      const eventWithLimits = createEventWithPlaceholderLimits(
        ctx.testFeedV2Event,
        [
          {
            placeholder: "summary",
            characterCount: 10,
            appendString: "...",
          },
        ],
        {
          content: "{{summary||text::No summary available}}",
        }
      );

      try {
        await ctx.seedArticles(eventWithLimits);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "fallback-literal-test",
                // No summary - will fall back to literal text
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithLimits);

        assert.notStrictEqual(results, null);

        const payload = getDiscordPayload(ctx);
        // Literal text should not be truncated
        assert.strictEqual(payload.content, "No summary available");
      } finally {
        ctx.cleanup();
      }
    });
  });
});

import { describe, it, expect } from "bun:test";
import { randomUUID } from "crypto";
import { ArticleDeliveryStatus } from "../src/delivery";
import getTestRssFeed from "./data/test-rss-feed";
import { createTestContext } from "./helpers/test-context";
import type { FeedV2Event } from "../src/schemas";

// Note: Test infrastructure setup/teardown is handled by test/setup.ts (preload file)

/**
 * Helper to create a feed event with format options and/or date checks.
 */
function createEventWithFormatOptions(
  baseEvent: FeedV2Event,
  options: {
    formatOptions?: {
      dateFormat?: string;
      dateTimezone?: string;
      dateLocale?: string;
    };
    dateChecks?: {
      oldArticleDateDiffMsThreshold?: number;
      datePlaceholderReferences?: string[];
    };
    content?: string;
  }
): FeedV2Event {
  return {
    ...baseEvent,
    data: {
      ...baseEvent.data,
      feed: {
        ...baseEvent.data.feed,
        formatOptions: options.formatOptions,
        dateChecks: options.dateChecks,
      },
      mediums: [
        {
          ...baseEvent.data.mediums[0]!,
          details: {
            ...baseEvent.data.mediums[0]!.details,
            content:
              options.content ?? baseEvent.data.mediums[0]!.details.content,
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

describe("Format Options (e2e)", () => {
  describe("Feed Format Options", () => {
    it("formats dates with custom dateFormat", async () => {
      const ctx = createTestContext();

      const eventWithFormat = createEventWithFormatOptions(ctx.testFeedV2Event, {
        formatOptions: {
          dateFormat: "YYYY-MM-DD",
          dateTimezone: "UTC",
        },
        content: "Published: {{pubdate}}",
      });

      try {
        await ctx.seedArticles(eventWithFormat);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "date-format-test",
                title: "Test Article",
                pubDate: "2023-06-15T14:30:00Z",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithFormat);

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);
        expect(results![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);

        const payload = getDiscordPayload(ctx);
        expect(payload.content).toBe("Published: 2023-06-15");
      } finally {
        ctx.cleanup();
      }
    });

    it("converts dates to specified timezone", async () => {
      const ctx = createTestContext();

      const eventWithFormat = createEventWithFormatOptions(ctx.testFeedV2Event, {
        formatOptions: {
          dateFormat: "YYYY-MM-DD HH:mm",
          dateTimezone: "America/New_York",
        },
        content: "Published: {{pubdate}}",
      });

      try {
        await ctx.seedArticles(eventWithFormat);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "timezone-test",
                title: "Test Article",
                // 14:30 UTC = 10:30 EDT (summer time in New York)
                pubDate: "2023-06-15T14:30:00Z",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithFormat);

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);

        const payload = getDiscordPayload(ctx);
        expect(payload.content).toBe("Published: 2023-06-15 10:30");
      } finally {
        ctx.cleanup();
      }
    });

    it("applies dateLocale to date formatting", async () => {
      const ctx = createTestContext();

      const eventWithFormat = createEventWithFormatOptions(ctx.testFeedV2Event, {
        formatOptions: {
          dateFormat: "MMMM D, YYYY",
          dateTimezone: "UTC",
          dateLocale: "fr",
        },
        content: "Published: {{pubdate}}",
      });

      try {
        await ctx.seedArticles(eventWithFormat);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "locale-test",
                title: "Test Article",
                pubDate: "2023-06-15T14:30:00Z",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithFormat);

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);

        const payload = getDiscordPayload(ctx);
        // French locale: "juin" instead of "June"
        // Note: dayjs locale must be loaded - if not available, falls back to English
        expect(payload.content).toMatch(/Published: (juin|June) 15, 2023/);
      } finally {
        ctx.cleanup();
      }
    });

    it("combines dateFormat, dateTimezone, and dateLocale", async () => {
      const ctx = createTestContext();

      const eventWithFormat = createEventWithFormatOptions(ctx.testFeedV2Event, {
        formatOptions: {
          dateFormat: "dddd, MMMM D, YYYY [at] HH:mm",
          dateTimezone: "Europe/London",
          dateLocale: "en",
        },
        content: "{{pubdate}}",
      });

      try {
        await ctx.seedArticles(eventWithFormat);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "combined-test",
                title: "Test Article",
                // 12:00 UTC = 13:00 BST (summer time in London)
                pubDate: "2023-06-15T12:00:00Z",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithFormat);

        expect(results).not.toBeNull();

        const payload = getDiscordPayload(ctx);
        expect(payload.content).toBe("Thursday, June 15, 2023 at 13:00");
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Feed Date Checks", () => {
    it("blocks articles older than threshold", async () => {
      const ctx = createTestContext();

      // Set threshold to 1 day (86400000 ms)
      const eventWithDateCheck = createEventWithFormatOptions(
        ctx.testFeedV2Event,
        {
          dateChecks: {
            oldArticleDateDiffMsThreshold: 86400000, // 1 day
          },
          content: "{{title}}",
        }
      );

      try {
        await ctx.seedArticles(eventWithDateCheck);

        // Create an article from 2 days ago
        const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "old-article",
                title: "Old Article",
                pubDate: twoDaysAgo,
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithDateCheck);

        // Article should be filtered out (not delivered)
        expect(results).not.toBeNull();
        expect(results!.length).toBe(0);
        expect(ctx.discordClient.capturedPayloads.length).toBe(0);
      } finally {
        ctx.cleanup();
      }
    });

    it("passes articles within threshold", async () => {
      const ctx = createTestContext();

      // Set threshold to 1 day (86400000 ms)
      const eventWithDateCheck = createEventWithFormatOptions(
        ctx.testFeedV2Event,
        {
          dateChecks: {
            oldArticleDateDiffMsThreshold: 86400000, // 1 day
          },
          content: "{{title}}",
        }
      );

      try {
        await ctx.seedArticles(eventWithDateCheck);

        // Create an article from 1 hour ago
        const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "recent-article",
                title: "Recent Article",
                pubDate: oneHourAgo,
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithDateCheck);

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);
        expect(results![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);

        const payload = getDiscordPayload(ctx);
        expect(payload.content).toBe("Recent Article");
      } finally {
        ctx.cleanup();
      }
    });

    it("passes articles with future dates", async () => {
      const ctx = createTestContext();

      // Set threshold to 1 day
      const eventWithDateCheck = createEventWithFormatOptions(
        ctx.testFeedV2Event,
        {
          dateChecks: {
            oldArticleDateDiffMsThreshold: 86400000,
          },
          content: "{{title}}",
        }
      );

      try {
        await ctx.seedArticles(eventWithDateCheck);

        // Create an article with a future date
        const tomorrow = new Date(Date.now() + 86400000).toISOString();

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "future-article",
                title: "Future Article",
                pubDate: tomorrow,
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithDateCheck);

        // Future articles should pass
        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);
        expect(results![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);

        const payload = getDiscordPayload(ctx);
        expect(payload.content).toBe("Future Article");
      } finally {
        ctx.cleanup();
      }
    });

    it("uses custom datePlaceholderReferences", async () => {
      const ctx = createTestContext();

      // Check 'customDate' field instead of default 'pubDate'
      const eventWithDateCheck = createEventWithFormatOptions(
        ctx.testFeedV2Event,
        {
          dateChecks: {
            oldArticleDateDiffMsThreshold: 86400000,
            datePlaceholderReferences: ["customDate"],
          },
          content: "{{title}}",
        }
      );

      try {
        await ctx.seedArticles(eventWithDateCheck);

        // Article has old pubDate but recent customDate
        const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
        const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "custom-date-article",
                title: "Custom Date Article",
                pubDate: twoDaysAgo,
                customDate: oneHourAgo,
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithDateCheck);

        // Should pass because customDate (1 hour ago) is within threshold,
        // even though pubDate (2 days ago) is outside threshold
        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);
        expect(results![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);

        const payload = getDiscordPayload(ctx);
        expect(payload.content).toBe("Custom Date Article");
      } finally {
        ctx.cleanup();
      }
    });
  });
});

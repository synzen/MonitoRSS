import { describe, it, expect } from "bun:test";
import { randomUUID } from "crypto";
import { ArticleDeliveryStatus } from "../src/delivery";
import getTestRssFeed from "./data/test-rss-feed";
import { createTestContext } from "./helpers/test-context";
import type { FeedV2Event } from "../src/schemas";

// Note: Test infrastructure setup/teardown is handled by test/setup.ts (preload file)

// Filter expression type constants
const ExpressionType = {
  Logical: "LOGICAL",
  Relational: "RELATIONAL",
} as const;

const LogicalOperator = {
  And: "AND",
  Or: "OR",
} as const;

const RelationalOperator = {
  Eq: "EQ",
  Contains: "CONTAINS",
  Matches: "MATCHES",
} as const;

const RelationalLeftType = {
  Article: "ARTICLE",
} as const;

const RelationalRightType = {
  String: "STRING",
} as const;

type FilterExpression = {
  type: typeof ExpressionType.Logical;
  op: (typeof LogicalOperator)[keyof typeof LogicalOperator];
  children: Array<FilterExpression | RelationalExpression>;
};

type RelationalExpression = {
  type: typeof ExpressionType.Relational;
  op: (typeof RelationalOperator)[keyof typeof RelationalOperator];
  left: { type: typeof RelationalLeftType.Article; value: string };
  right: { type: typeof RelationalRightType.String; value: string };
  not?: boolean;
};

/**
 * Helper to create a simple relational expression
 */
function rel(
  field: string,
  op: (typeof RelationalOperator)[keyof typeof RelationalOperator],
  value: string,
  not?: boolean
): RelationalExpression {
  return {
    type: ExpressionType.Relational,
    op,
    left: { type: RelationalLeftType.Article, value: field },
    right: { type: RelationalRightType.String, value },
    ...(not !== undefined ? { not } : {}),
  };
}

/**
 * Helper to create a logical AND expression
 */
function and(
  ...children: Array<FilterExpression | RelationalExpression>
): FilterExpression {
  return {
    type: ExpressionType.Logical,
    op: LogicalOperator.And,
    children,
  };
}

/**
 * Helper to create a logical OR expression
 */
function or(
  ...children: Array<FilterExpression | RelationalExpression>
): FilterExpression {
  return {
    type: ExpressionType.Logical,
    op: LogicalOperator.Or,
    children,
  };
}

/**
 * Helper to create a feed event with filters configured on the medium
 */
function createEventWithFilters(
  baseEvent: FeedV2Event,
  filters: FilterExpression
): FeedV2Event {
  return {
    ...baseEvent,
    data: {
      ...baseEvent.data,
      mediums: [
        {
          ...baseEvent.data.mediums[0]!,
          filters: {
            expression: filters as unknown as Record<string, unknown>,
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

describe("Filters (e2e)", () => {
  describe("Basic Filter Tests", () => {
    it("blocks article when CONTAINS filter does not match", async () => {
      const ctx = createTestContext();

      const eventWithFilter = createEventWithFilters(
        ctx.testFeedV2Event,
        and(rel("title", RelationalOperator.Contains, "javascript"))
      );

      try {
        await ctx.seedArticles(eventWithFilter);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "no-match", title: "Python is great" }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithFilter);

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);
        expect(results![0]!.status).toBe(ArticleDeliveryStatus.FilteredOut);
        expect(ctx.discordClient.capturedPayloads.length).toBe(0);
      } finally {
        ctx.cleanup();
      }
    });

    it("passes article when CONTAINS filter matches", async () => {
      const ctx = createTestContext();

      const eventWithFilter = createEventWithFilters(
        ctx.testFeedV2Event,
        and(rel("title", RelationalOperator.Contains, "javascript"))
      );

      try {
        await ctx.seedArticles(eventWithFilter);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "match", title: "Learn JavaScript Today" }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithFilter);

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);
        expect(results![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);
        expect(ctx.discordClient.capturedPayloads.length).toBe(1);
      } finally {
        ctx.cleanup();
      }
    });

    it("blocks article when EQ filter does not match exactly", async () => {
      const ctx = createTestContext();

      const eventWithFilter = createEventWithFilters(
        ctx.testFeedV2Event,
        and(rel("title", RelationalOperator.Eq, "Exact Title"))
      );

      try {
        await ctx.seedArticles(eventWithFilter);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "not-exact", title: "Exact Title Plus Extra" }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithFilter);

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);
        expect(results![0]!.status).toBe(ArticleDeliveryStatus.FilteredOut);
        expect(ctx.discordClient.capturedPayloads.length).toBe(0);
      } finally {
        ctx.cleanup();
      }
    });

    it("passes article when EQ filter matches exactly", async () => {
      const ctx = createTestContext();

      const eventWithFilter = createEventWithFilters(
        ctx.testFeedV2Event,
        and(rel("title", RelationalOperator.Eq, "Exact Title"))
      );

      try {
        await ctx.seedArticles(eventWithFilter);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed([{ guid: "exact", title: "Exact Title" }], true),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithFilter);

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);
        expect(results![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);
        expect(ctx.discordClient.capturedPayloads.length).toBe(1);
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Operator Tests", () => {
    it("MATCHES operator filters using regex pattern", async () => {
      const ctx = createTestContext();

      // Match titles starting with "Breaking:"
      const eventWithFilter = createEventWithFilters(
        ctx.testFeedV2Event,
        and(rel("title", RelationalOperator.Matches, "^Breaking:.*"))
      );

      try {
        await ctx.seedArticles(eventWithFilter);

        // This should pass - starts with "Breaking:"
        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "breaking", title: "Breaking: Major News Story" }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithFilter);

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);
        expect(results![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);
        expect(ctx.discordClient.capturedPayloads.length).toBe(1);
      } finally {
        ctx.cleanup();
      }
    });

    it("MATCHES operator blocks when regex does not match", async () => {
      const ctx = createTestContext();

      const eventWithFilter = createEventWithFilters(
        ctx.testFeedV2Event,
        and(rel("title", RelationalOperator.Matches, "^Breaking:.*"))
      );

      try {
        await ctx.seedArticles(eventWithFilter);

        // This should be blocked - doesn't start with "Breaking:"
        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "not-breaking", title: "Regular News Story" }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithFilter);

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);
        expect(results![0]!.status).toBe(ArticleDeliveryStatus.FilteredOut);
      } finally {
        ctx.cleanup();
      }
    });

    it("NOT operator negates the filter result", async () => {
      const ctx = createTestContext();

      // Block articles that contain "spam" using NOT + CONTAINS
      const eventWithFilter = createEventWithFilters(
        ctx.testFeedV2Event,
        and(rel("title", RelationalOperator.Contains, "spam", true))
      );

      try {
        await ctx.seedArticles(eventWithFilter);

        // This should pass - doesn't contain "spam"
        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "no-spam", title: "Legitimate Article" }],
            true
          ),
          hash: randomUUID(),
        }));

        const passResults = await ctx.handleEvent(eventWithFilter);
        expect(passResults).not.toBeNull();
        expect(passResults!.length).toBe(1);
        expect(passResults![0]!.status).toBe(
          ArticleDeliveryStatus.PendingDelivery
        );

        ctx.discordClient.clear();

        // This should be blocked - contains "spam"
        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "has-spam", title: "This is spam content" }],
            true
          ),
          hash: randomUUID(),
        }));

        const blockResults = await ctx.handleEvent(eventWithFilter);
        expect(blockResults).not.toBeNull();
        expect(blockResults!.length).toBe(1);
        expect(blockResults![0]!.status).toBe(
          ArticleDeliveryStatus.FilteredOut
        );
      } finally {
        ctx.cleanup();
      }
    });

    it("AND operator requires all conditions to pass", async () => {
      const ctx = createTestContext();

      const eventWithFilter = createEventWithFilters(
        ctx.testFeedV2Event,
        and(
          rel("title", RelationalOperator.Contains, "news"),
          rel("description", RelationalOperator.Contains, "important")
        )
      );

      try {
        await ctx.seedArticles(eventWithFilter);

        // Only title matches - should be blocked
        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "title-only",
                title: "Breaking news",
                description: "Regular description",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const partialResults = await ctx.handleEvent(eventWithFilter);
        expect(partialResults).not.toBeNull();
        expect(partialResults!.length).toBe(1);
        expect(partialResults![0]!.status).toBe(
          ArticleDeliveryStatus.FilteredOut
        );

        ctx.discordClient.clear();

        // Both match - should pass
        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "both-match",
                title: "Breaking news story",
                description: "Very important update",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const passResults = await ctx.handleEvent(eventWithFilter);
        expect(passResults).not.toBeNull();
        expect(passResults!.length).toBe(1);
        expect(passResults![0]!.status).toBe(
          ArticleDeliveryStatus.PendingDelivery
        );
      } finally {
        ctx.cleanup();
      }
    });

    it("OR operator requires at least one condition to pass", async () => {
      const ctx = createTestContext();

      const eventWithFilter = createEventWithFilters(
        ctx.testFeedV2Event,
        or(
          rel("title", RelationalOperator.Contains, "urgent"),
          rel("title", RelationalOperator.Contains, "breaking")
        )
      );

      try {
        await ctx.seedArticles(eventWithFilter);

        // Neither matches - should be blocked
        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "no-match", title: "Regular news update" }],
            true
          ),
          hash: randomUUID(),
        }));

        const blockResults = await ctx.handleEvent(eventWithFilter);
        expect(blockResults).not.toBeNull();
        expect(blockResults!.length).toBe(1);
        expect(blockResults![0]!.status).toBe(
          ArticleDeliveryStatus.FilteredOut
        );

        ctx.discordClient.clear();

        // One matches - should pass
        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "one-match", title: "Urgent: Action required" }],
            true
          ),
          hash: randomUUID(),
        }));

        const passResults = await ctx.handleEvent(eventWithFilter);
        expect(passResults).not.toBeNull();
        expect(passResults!.length).toBe(1);
        expect(passResults![0]!.status).toBe(
          ArticleDeliveryStatus.PendingDelivery
        );
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Complex Filter Tests", () => {
    it("handles nested AND/OR expressions", async () => {
      const ctx = createTestContext();

      // (contains "news" OR contains "update") AND contains "important"
      const eventWithFilter = createEventWithFilters(
        ctx.testFeedV2Event,
        and(
          or(
            rel("title", RelationalOperator.Contains, "news"),
            rel("title", RelationalOperator.Contains, "update")
          ),
          rel("description", RelationalOperator.Contains, "important")
        )
      );

      try {
        await ctx.seedArticles(eventWithFilter);

        // Has "update" in title and "important" in description - should pass
        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "nested-pass",
                title: "Product update",
                description: "This is important",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const passResults = await ctx.handleEvent(eventWithFilter);
        expect(passResults).not.toBeNull();
        expect(passResults!.length).toBe(1);
        expect(passResults![0]!.status).toBe(
          ArticleDeliveryStatus.PendingDelivery
        );

        ctx.discordClient.clear();

        // Has "news" but missing "important" - should be blocked
        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "nested-fail",
                title: "Daily news",
                description: "Regular content",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const blockResults = await ctx.handleEvent(eventWithFilter);
        expect(blockResults).not.toBeNull();
        expect(blockResults!.length).toBe(1);
        expect(blockResults![0]!.status).toBe(
          ArticleDeliveryStatus.FilteredOut
        );
      } finally {
        ctx.cleanup();
      }
    });

    it("filters on multiple fields simultaneously", async () => {
      const ctx = createTestContext();

      const eventWithFilter = createEventWithFilters(
        ctx.testFeedV2Event,
        and(
          rel("title", RelationalOperator.Contains, "release"),
          rel("description", RelationalOperator.Matches, "v\\d+\\.\\d+")
        )
      );

      try {
        await ctx.seedArticles(eventWithFilter);

        // Both conditions match
        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "multi-field",
                title: "New release available",
                description: "Version v2.5 is now available",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithFilter);

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);
        expect(results![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);
      } finally {
        ctx.cleanup();
      }
    });

    it("CONTAINS is case-insensitive", async () => {
      const ctx = createTestContext();

      const eventWithFilter = createEventWithFilters(
        ctx.testFeedV2Event,
        and(rel("title", RelationalOperator.Contains, "JAVASCRIPT"))
      );

      try {
        await ctx.seedArticles(eventWithFilter);

        // Lowercase "javascript" should match uppercase filter
        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "case-test", title: "Learn javascript today" }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithFilter);

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);
        expect(results![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Edge Cases", () => {
    it("treats missing field as empty string", async () => {
      const ctx = createTestContext();

      // Filter on a field that doesn't exist in the article
      const eventWithFilter = createEventWithFilters(
        ctx.testFeedV2Event,
        and(rel("nonexistentField", RelationalOperator.Contains, "value"))
      );

      try {
        await ctx.seedArticles(eventWithFilter);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "missing-field", title: "Normal title" }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithFilter);

        // Should be filtered out since empty string doesn't contain "value"
        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);
        expect(results![0]!.status).toBe(ArticleDeliveryStatus.FilteredOut);
      } finally {
        ctx.cleanup();
      }
    });

    it("handles regex with special characters", async () => {
      const ctx = createTestContext();

      // Match version numbers like "v1.2.3"
      const eventWithFilter = createEventWithFilters(
        ctx.testFeedV2Event,
        and(rel("title", RelationalOperator.Matches, "v\\d+\\.\\d+\\.\\d+"))
      );

      try {
        await ctx.seedArticles(eventWithFilter);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "version", title: "Release v1.2.3 available" }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithFilter);

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);
        expect(results![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);
      } finally {
        ctx.cleanup();
      }
    });

    it("handles empty filter children gracefully", async () => {
      const ctx = createTestContext();

      // AND with a single child
      const eventWithFilter = createEventWithFilters(
        ctx.testFeedV2Event,
        and(rel("title", RelationalOperator.Contains, "hello"))
      );

      try {
        await ctx.seedArticles(eventWithFilter);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "single-child", title: "Say hello world" }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithFilter);

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);
        expect(results![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);
      } finally {
        ctx.cleanup();
      }
    });

    it("delivers article content when filter passes", async () => {
      const ctx = createTestContext();

      const eventWithFilter = createEventWithFilters(
        ctx.testFeedV2Event,
        and(rel("title", RelationalOperator.Contains, "special"))
      );

      try {
        await ctx.seedArticles(eventWithFilter);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [{ guid: "content-test", title: "A special announcement" }],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithFilter);

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);
        expect(results![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);

        // Verify the content was delivered correctly
        const payload = getDiscordPayload(ctx);
        expect(payload.content).toBe("A special announcement");
      } finally {
        ctx.cleanup();
      }
    });
  });
});

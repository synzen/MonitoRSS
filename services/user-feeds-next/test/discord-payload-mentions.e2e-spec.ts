import { describe, it, expect } from "bun:test";
import { randomUUID } from "crypto";
import { ArticleDeliveryStatus } from "../src/delivery";
import getTestRssFeed from "./data/test-rss-feed";
import { createTestContext } from "./helpers/test-context";
import type { FeedV2Event, MentionTargetInput } from "../src/schemas";

// Note: Test infrastructure setup/teardown is handled by test/setup.ts (preload file)

type MentionsConfig = NonNullable<
  FeedV2Event["data"]["mediums"][0]["details"]["mentions"]
>;

type MediumDetails = FeedV2Event["data"]["mediums"][0]["details"];

type MentionsInput = {
  targets?: MentionTargetInput[];
};

/**
 * Helper to create a feed event with mentions configured on the medium.
 * Uses z.input types which allow omitting fields with defaults.
 */
function createEventWithMentions(
  baseEvent: FeedV2Event,
  mentionsInput: MentionsInput,
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
            mentions: mentionsInput as MediumDetails["mentions"],
            content: content ?? "{{discord::mentions}} - {{title}}",
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

describe("Discord Payload Mentions (e2e)", () => {
  describe("User Mentions", () => {
    it("includes user mention in payload", async () => {
      const ctx = createTestContext();

      const eventWithMentions = createEventWithMentions(ctx.testFeedV2Event, {
        targets: [
          {
            id: "123456789",
            type: "user",
          },
        ],
      });

      try {
        await ctx.seedArticles(eventWithMentions);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "user-mention-test",
                title: "User Mention Article",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithMentions);

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);
        expect(results![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);

        const payload = getDiscordPayload(ctx);
        expect(payload.content).toContain("<@123456789>");
        expect(payload.content).toContain("User Mention Article");
      } finally {
        ctx.cleanup();
      }
    });

    it("includes multiple user mentions in payload", async () => {
      const ctx = createTestContext();

      const eventWithMentions = createEventWithMentions(ctx.testFeedV2Event, {
        targets: [
          { id: "111111111", type: "user" },
          { id: "222222222", type: "user" },
          { id: "333333333", type: "user" },
        ],
      });

      try {
        await ctx.seedArticles(eventWithMentions);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "multiple-user-mentions-test",
                title: "Multiple Mentions Article",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithMentions);

        expect(results).not.toBeNull();

        const payload = getDiscordPayload(ctx);
        expect(payload.content).toContain("<@111111111>");
        expect(payload.content).toContain("<@222222222>");
        expect(payload.content).toContain("<@333333333>");
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Role Mentions", () => {
    it("includes role mention in payload", async () => {
      const ctx = createTestContext();

      const eventWithMentions = createEventWithMentions(ctx.testFeedV2Event, {
        targets: [
          {
            id: "987654321",
            type: "role",
          },
        ],
      });

      try {
        await ctx.seedArticles(eventWithMentions);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "role-mention-test",
                title: "Role Mention Article",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithMentions);

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);

        const payload = getDiscordPayload(ctx);
        // Role mentions use <@&ID> format
        expect(payload.content).toContain("<@&987654321>");
      } finally {
        ctx.cleanup();
      }
    });

    it("includes multiple role mentions in payload", async () => {
      const ctx = createTestContext();

      const eventWithMentions = createEventWithMentions(ctx.testFeedV2Event, {
        targets: [
          { id: "role-1", type: "role" },
          { id: "role-2", type: "role" },
        ],
      });

      try {
        await ctx.seedArticles(eventWithMentions);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "multiple-role-mentions-test",
                title: "Multiple Roles Article",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithMentions);

        expect(results).not.toBeNull();

        const payload = getDiscordPayload(ctx);
        expect(payload.content).toContain("<@&role-1>");
        expect(payload.content).toContain("<@&role-2>");
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Mixed Mentions", () => {
    it("includes both user and role mentions in payload", async () => {
      const ctx = createTestContext();

      const eventWithMentions = createEventWithMentions(ctx.testFeedV2Event, {
        targets: [
          { id: "user-123", type: "user" },
          { id: "role-456", type: "role" },
          { id: "user-789", type: "user" },
        ],
      });

      try {
        await ctx.seedArticles(eventWithMentions);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "mixed-mentions-test",
                title: "Mixed Mentions Article",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithMentions);

        expect(results).not.toBeNull();

        const payload = getDiscordPayload(ctx);
        expect(payload.content).toContain("<@user-123>");
        expect(payload.content).toContain("<@&role-456>");
        expect(payload.content).toContain("<@user-789>");
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Conditional Mentions with Filters", () => {
    it("includes mention when filter matches", async () => {
      const ctx = createTestContext();

      const eventWithMentions = createEventWithMentions(ctx.testFeedV2Event, {
        targets: [
          {
            id: "tech-user",
            type: "user",
            filters: {
              expression: {
                type: "LOGICAL",
                op: "AND",
                children: [
                  {
                    type: "RELATIONAL",
                    op: "CONTAINS",
                    left: { type: "ARTICLE", value: "title" },
                    right: { type: "STRING", value: "Technology" },
                  },
                ],
              },
            },
          },
        ],
      });

      try {
        await ctx.seedArticles(eventWithMentions);

        // Article title contains "Technology"
        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "mention-filter-match-test",
                title: "Technology News Update",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithMentions);

        expect(results).not.toBeNull();

        const payload = getDiscordPayload(ctx);
        expect(payload.content).toContain("<@tech-user>");
      } finally {
        ctx.cleanup();
      }
    });

    it("excludes mention when filter does not match", async () => {
      const ctx = createTestContext();

      const eventWithMentions = createEventWithMentions(ctx.testFeedV2Event, {
        targets: [
          {
            id: "tech-user",
            type: "user",
            filters: {
              expression: {
                type: "LOGICAL",
                op: "AND",
                children: [
                  {
                    type: "RELATIONAL",
                    op: "CONTAINS",
                    left: { type: "ARTICLE", value: "title" },
                    right: { type: "STRING", value: "Technology" },
                  },
                ],
              },
            },
          },
        ],
      });

      try {
        await ctx.seedArticles(eventWithMentions);

        // Article title does NOT contain "Technology"
        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "mention-filter-no-match-test",
                title: "Sports News Update",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithMentions);

        expect(results).not.toBeNull();

        const payload = getDiscordPayload(ctx);
        expect(payload.content).not.toContain("<@tech-user>");
      } finally {
        ctx.cleanup();
      }
    });

    it("includes some mentions and excludes others based on filters", async () => {
      const ctx = createTestContext();

      const eventWithMentions = createEventWithMentions(ctx.testFeedV2Event, {
        targets: [
          {
            id: "always-user",
            type: "user",
            // No filters - always included
          },
          {
            id: "tech-role",
            type: "role",
            filters: {
              expression: {
                type: "LOGICAL",
                op: "AND",
                children: [
                  {
                    type: "RELATIONAL",
                    op: "CONTAINS",
                    left: { type: "ARTICLE", value: "title" },
                    right: { type: "STRING", value: "Tech" },
                  },
                ],
              },
            },
          },
          {
            id: "sports-user",
            type: "user",
            filters: {
              expression: {
                type: "LOGICAL",
                op: "AND",
                children: [
                  {
                    type: "RELATIONAL",
                    op: "CONTAINS",
                    left: { type: "ARTICLE", value: "title" },
                    right: { type: "STRING", value: "Sports" },
                  },
                ],
              },
            },
          },
        ],
      });

      try {
        await ctx.seedArticles(eventWithMentions);

        // Article title contains "Tech" but not "Sports"
        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "mixed-filter-test",
                title: "Tech Industry Report",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithMentions);

        expect(results).not.toBeNull();

        const payload = getDiscordPayload(ctx);
        // always-user should be included (no filter)
        expect(payload.content).toContain("<@always-user>");
        // tech-role should be included (filter matches "Tech")
        expect(payload.content).toContain("<@&tech-role>");
        // sports-user should NOT be included (filter doesn't match "Sports")
        expect(payload.content).not.toContain("<@sports-user>");
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Mentions Placeholder Usage", () => {
    it("uses mentions placeholder in content template", async () => {
      const ctx = createTestContext();

      const eventWithMentions = createEventWithMentions(
        ctx.testFeedV2Event,
        {
          targets: [{ id: "notify-user", type: "user" }],
        },
        "Hey {{discord::mentions}}! Check out: {{title}}"
      );

      try {
        await ctx.seedArticles(eventWithMentions);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "mentions-placeholder-test",
                title: "Important Update",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithMentions);

        expect(results).not.toBeNull();

        const payload = getDiscordPayload(ctx);
        expect(payload.content).toBe(
          "Hey <@notify-user>! Check out: Important Update"
        );
      } finally {
        ctx.cleanup();
      }
    });

    it("handles empty mentions placeholder when no mentions match", async () => {
      const ctx = createTestContext();

      const eventWithMentions = createEventWithMentions(
        ctx.testFeedV2Event,
        {
          targets: [
            {
              id: "conditional-user",
              type: "user",
              filters: {
                expression: {
                  type: "LOGICAL",
                  op: "AND",
                  children: [
                    {
                      type: "RELATIONAL",
                      op: "CONTAINS",
                      left: { type: "ARTICLE", value: "title" },
                      right: { type: "STRING", value: "NEVER_MATCH" },
                    },
                  ],
                },
              },
            },
          ],
        },
        "{{discord::mentions}} New: {{title}}"
      );

      try {
        await ctx.seedArticles(eventWithMentions);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "no-mentions-test",
                title: "Regular Article",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithMentions);

        expect(results).not.toBeNull();

        const payload = getDiscordPayload(ctx);
        // Mention placeholder should be empty since filter didn't match
        expect(payload.content).not.toContain("<@conditional-user>");
        expect(payload.content).toContain("New: Regular Article");
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("No Mentions Configuration", () => {
    it("handles null mentions configuration", async () => {
      const ctx = createTestContext();

      const eventWithoutMentions: FeedV2Event = {
        ...ctx.testFeedV2Event,
        data: {
          ...ctx.testFeedV2Event.data,
          mediums: [
            {
              ...ctx.testFeedV2Event.data.mediums[0]!,
              details: {
                ...ctx.testFeedV2Event.data.mediums[0]!.details,
                mentions: null,
                content: "{{discord::mentions}} {{title}}",
              },
            },
          ],
        },
      };

      try {
        await ctx.seedArticles(eventWithoutMentions);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "no-mentions-config-test",
                title: "Article without Mentions",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithoutMentions);

        expect(results).not.toBeNull();

        const payload = getDiscordPayload(ctx);
        // Should not contain any mention tags
        expect(payload.content).not.toMatch(/<@[!&]?\d+>/);
        expect(payload.content).toContain("Article without Mentions");
      } finally {
        ctx.cleanup();
      }
    });
  });
});

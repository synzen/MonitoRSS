import { describe, it, before, after } from "node:test";
import * as assert from "node:assert";
import { randomUUID } from "crypto";
import { ArticleDeliveryStatus } from "../../src/delivery";
import getTestRssFeed from "../data/test-rss-feed";
import { createTestContext } from "../helpers/test-context";
import { setupTestDatabase, teardownTestDatabase, type TestStores } from "../helpers/setup-integration-tests";
import type {
  FeedV2Event,
  ForumTagInput,
  EmbedInput,
} from "../../src/shared/schemas";

let stores: TestStores;

type MediumDetails = FeedV2Event["data"]["mediums"][0]["details"];

/**
 * Helper to create a feed event with forum channel configured on the medium.
 * Uses z.input types which allow omitting fields with defaults.
 */
function createEventWithForumChannel(
  baseEvent: FeedV2Event,
  options: {
    forumThreadTitle?: string | null;
    forumThreadTags?: ForumTagInput[] | null;
    content?: string;
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
            channel: {
              id: "forum-channel-123",
              type: "forum",
            },
            forumThreadTitle: options.forumThreadTitle ?? null,
            forumThreadTags: (options.forumThreadTags ??
              null) as MediumDetails["forumThreadTags"],
            content:
              options.content ?? baseEvent.data.mediums[0]!.details.content,
          },
        },
      ],
    },
  };
}

/**
 * Helper to create a feed event with forum webhook configured on the medium.
 * Uses z.input types which allow omitting fields with defaults.
 */
function createEventWithForumWebhook(
  baseEvent: FeedV2Event,
  options: {
    forumThreadTitle?: string | null;
    forumThreadTags?: ForumTagInput[] | null;
    webhookName?: string;
    webhookIconUrl?: string;
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
            channel: null,
            webhook: {
              id: "forum-webhook-123",
              token: "forum-webhook-token",
              type: "forum",
              name: options.webhookName,
              iconUrl: options.webhookIconUrl,
            },
            forumThreadTitle: options.forumThreadTitle ?? null,
            forumThreadTags: (options.forumThreadTags ??
              null) as MediumDetails["forumThreadTags"],
            content:
              options.content ?? baseEvent.data.mediums[0]!.details.content,
            embeds: (options.embeds ?? []) as MediumDetails["embeds"],
          },
        },
      ],
    },
  };
}

/**
 * Helper to extract the Discord payload from captured requests.
 * Note: For api-request type (forum threads), body is an object.
 * For enqueue type (regular messages), body is a JSON string.
 */
function getDiscordPayload(
  ctx: ReturnType<typeof createTestContext>,
  type?: "enqueue" | "api-request"
) {
  assert.ok(ctx.discordClient.capturedPayloads.length > 0);

  // Find the payload of the requested type, or use the first one
  const captured = type
    ? (ctx.discordClient.capturedPayloads.find((p) => p.type === type) ??
      ctx.discordClient.capturedPayloads[0]!)
    : ctx.discordClient.capturedPayloads[0]!;

  if (captured.type === "api-request") {
    // api-request body is already an object
    return captured.options.body as Record<string, unknown>;
  }

  // enqueue body is a JSON string
  return JSON.parse(captured.options.body as string);
}

/**
 * Helper to get the payload type (enqueue or api-request)
 */
function getPayloadType(ctx: ReturnType<typeof createTestContext>): string {
  assert.ok(ctx.discordClient.capturedPayloads.length > 0);
  return ctx.discordClient.capturedPayloads[0]!.type;
}

describe("Discord Payload Forum Channels (e2e)", { concurrency: true }, () => {
  before(async () => {
    stores = await setupTestDatabase();
  });

  after(async () => {
    await teardownTestDatabase();
  });

  describe("Forum Thread Title", () => {
    it("creates forum thread with custom title using placeholders", async () => {
      const ctx = createTestContext(stores);

      const eventWithForum = createEventWithForumChannel(ctx.testFeedV2Event, {
        forumThreadTitle: "News: {{title}}",
      });

      try {
        await ctx.seedArticles(eventWithForum);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "forum-thread-title-test",
                title: "Breaking News Article",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithForum);

        assert.notStrictEqual(results, null);
        assert.ok(results!.length >= 1);

        // Forum channel delivery uses api-request for thread creation
        const payloadType = getPayloadType(ctx);
        assert.strictEqual(payloadType, "api-request");

        const payload = getDiscordPayload(ctx);
        assert.strictEqual(payload.name, "News: Breaking News Article");
      } finally {
        ctx.cleanup();
      }
    });

    it("uses default title when forumThreadTitle is not set", async () => {
      const ctx = createTestContext(stores);

      const eventWithForum = createEventWithForumChannel(ctx.testFeedV2Event, {
        forumThreadTitle: null,
      });

      try {
        await ctx.seedArticles(eventWithForum);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "forum-default-title-test",
                title: "Article Title for Thread",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithForum);

        assert.notStrictEqual(results, null);

        const payload = getDiscordPayload(ctx);
        // Default title template is {{title}}
        assert.strictEqual(payload.name, "Article Title for Thread");
      } finally {
        ctx.cleanup();
      }
    });

    it("truncates forum thread title to 100 characters", async () => {
      const ctx = createTestContext(stores);

      const eventWithForum = createEventWithForumChannel(ctx.testFeedV2Event, {
        forumThreadTitle: "{{title}}",
      });

      try {
        await ctx.seedArticles(eventWithForum);

        // Title longer than 100 characters
        const longTitle = "A".repeat(150);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "forum-long-title-test",
                title: longTitle,
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithForum);

        assert.notStrictEqual(results, null);

        const payload = getDiscordPayload(ctx);
        assert.ok(payload.name.length <= 100);
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Forum Thread Tags", () => {
    it("includes forum tags in payload", async () => {
      const ctx = createTestContext(stores);

      const eventWithForum = createEventWithForumChannel(ctx.testFeedV2Event, {
        forumThreadTitle: "{{title}}",
        forumThreadTags: [{ id: "tag-1" }, { id: "tag-2" }],
      });

      try {
        await ctx.seedArticles(eventWithForum);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "forum-tags-test",
                title: "Tagged Article",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithForum);

        assert.notStrictEqual(results, null);

        const payload = getDiscordPayload(ctx);
        assert.ok(Array.isArray(payload.applied_tags));
        assert.ok(payload.applied_tags.includes("tag-1"));
        assert.ok(payload.applied_tags.includes("tag-2"));
      } finally {
        ctx.cleanup();
      }
    });

    it("filters forum tags based on expression", async () => {
      const ctx = createTestContext(stores);

      const eventWithForum = createEventWithForumChannel(ctx.testFeedV2Event, {
        forumThreadTitle: "{{title}}",
        forumThreadTags: [
          { id: "tag-always" }, // No filter, always included
          {
            id: "tag-tech",
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
        await ctx.seedArticles(eventWithForum);

        // Article title does NOT contain "Technology"
        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "forum-tag-filter-test",
                title: "Sports News",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithForum);

        assert.notStrictEqual(results, null);

        const payload = getDiscordPayload(ctx);
        assert.ok(Array.isArray(payload.applied_tags));
        // tag-always should be included, tag-tech should not (filter didn't match)
        assert.ok(payload.applied_tags.includes("tag-always"));
        assert.ok(!payload.applied_tags.includes("tag-tech"));
      } finally {
        ctx.cleanup();
      }
    });

    it("includes filtered tag when expression matches", async () => {
      const ctx = createTestContext(stores);

      const eventWithForum = createEventWithForumChannel(ctx.testFeedV2Event, {
        forumThreadTitle: "{{title}}",
        forumThreadTags: [
          {
            id: "tag-tech",
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
        ],
      });

      try {
        await ctx.seedArticles(eventWithForum);

        // Article title DOES contain "Tech"
        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "forum-tag-match-test",
                title: "Tech Industry Update",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithForum);

        assert.notStrictEqual(results, null);

        const payload = getDiscordPayload(ctx);
        assert.ok(payload.applied_tags.includes("tag-tech"));
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Forum Channel Thread Structure", () => {
    it("creates channel forum thread with correct structure", async () => {
      const ctx = createTestContext(stores);

      const eventWithForum = createEventWithForumChannel(ctx.testFeedV2Event, {
        forumThreadTitle: "{{title}}",
        content: "Read more about this topic!",
      });

      try {
        await ctx.seedArticles(eventWithForum);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "forum-structure-test",
                title: "Forum Thread Structure Test",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithForum);

        assert.notStrictEqual(results, null);

        const payload = getDiscordPayload(ctx);

        // Channel forum uses name, message, applied_tags, type structure
        assert.notStrictEqual(payload.name, undefined);
        assert.notStrictEqual(payload.message, undefined);
        assert.strictEqual(payload.type, 11); // GUILD_PUBLIC_THREAD

        // Message content should be in the message object
        assert.strictEqual(payload.message.content, "Read more about this topic!");
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Forum Webhook Thread Structure", () => {
    it("creates webhook forum thread with thread_name", async () => {
      const ctx = createTestContext(stores);

      const eventWithForum = createEventWithForumWebhook(ctx.testFeedV2Event, {
        forumThreadTitle: "Webhook: {{title}}",
        webhookName: "RSS Bot",
      });

      try {
        await ctx.seedArticles(eventWithForum);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "forum-webhook-test",
                title: "Webhook Forum Article",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithForum);

        assert.notStrictEqual(results, null);

        // Webhook forum uses api-request for thread creation
        const payload = getDiscordPayload(ctx, "api-request");

        // Webhook forum uses thread_name instead of name
        assert.strictEqual(payload.thread_name, "Webhook: Webhook Forum Article");
        assert.strictEqual(payload.username, "RSS Bot");
      } finally {
        ctx.cleanup();
      }
    });

    it("creates webhook forum thread with avatar and tags", async () => {
      const ctx = createTestContext(stores);

      const eventWithForum = createEventWithForumWebhook(ctx.testFeedV2Event, {
        forumThreadTitle: "{{title}}",
        webhookName: "News Bot",
        webhookIconUrl: "https://example.com/bot-avatar.png",
        forumThreadTags: [{ id: "news-tag" }],
      });

      try {
        await ctx.seedArticles(eventWithForum);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "forum-webhook-full-test",
                title: "Full Webhook Forum Test",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithForum);

        assert.notStrictEqual(results, null);

        // Webhook forum uses api-request for thread creation
        const payload = getDiscordPayload(ctx, "api-request");

        assert.strictEqual(payload.thread_name, "Full Webhook Forum Test");
        assert.strictEqual(payload.username, "News Bot");
        assert.strictEqual(payload.avatar_url, "https://example.com/bot-avatar.png");
        assert.ok(payload.applied_tags.includes("news-tag"));
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Forum Content and Embeds", () => {
    it("includes content and embeds in forum thread message", async () => {
      const ctx = createTestContext(stores);

      const baseEvent = createEventWithForumChannel(ctx.testFeedV2Event, {
        forumThreadTitle: "{{title}}",
        content: "Article content: {{description}}",
      });

      // Add embeds to the event
      const eventWithEmbeds: FeedV2Event = {
        ...baseEvent,
        data: {
          ...baseEvent.data,
          mediums: [
            {
              ...baseEvent.data.mediums[0]!,
              details: {
                ...baseEvent.data.mediums[0]!.details,
                embeds: [
                  {
                    title: "{{title}}",
                    description: "{{description}}",
                    color: 0x00ff00,
                  },
                ] as MediumDetails["embeds"],
              },
            },
          ],
        },
      };

      try {
        await ctx.seedArticles(eventWithEmbeds);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "forum-embeds-test",
                title: "Forum with Embeds",
                description: "Forum article description",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithEmbeds);

        assert.notStrictEqual(results, null);

        // Channel forum uses api-request for thread creation
        const payload = getDiscordPayload(ctx, "api-request");

        // Content should be in the message object
        assert.strictEqual((payload.message as Record<string, unknown>).content,
          "Article content: Forum article description"
        );

        // Embeds should be in the message object
        const message = payload.message as Record<string, unknown>;
        assert.ok(Array.isArray(message.embeds));
        const embeds = message.embeds as Array<Record<string, unknown>>;
        assert.ok(embeds.length > 0);
        assert.strictEqual(embeds[0]!.title, "Forum with Embeds");
        assert.strictEqual(embeds[0]!.description, "Forum article description");
        assert.strictEqual(embeds[0]!.color, 0x00ff00);
      } finally {
        ctx.cleanup();
      }
    });
  });
});

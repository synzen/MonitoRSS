import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { randomUUID } from "crypto";
import { ArticleDeliveryStatus } from "../../src/delivery";
import getTestRssFeed from "../data/test-rss-feed";
import { createTestContext } from "../helpers/test-context";
import { setupTestDatabase, teardownTestDatabase, type TestStores } from "../helpers/setup-integration-tests";
import type { FeedV2Event, EmbedInput, ComponentV2Input } from "../../src/shared/schemas";

type MediumDetails = FeedV2Event["data"]["mediums"][0]["details"];

let stores: TestStores;

/**
 * Helper to create a feed event with webhook configured on the medium.
 * Uses z.input types which allow omitting fields with defaults.
 */
function createEventWithWebhook(
  baseEvent: FeedV2Event,
  webhook: {
    id: string;
    token: string;
    type?: "forum" | "thread" | "forum-thread" | null;
    name?: string;
    iconUrl?: string;
    threadId?: string | null;
  },
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
            channel: null, // Remove channel to use webhook
            webhook: {
              ...webhook,
              type: webhook.type ?? null,
            },
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

/**
 * Helper to get the URL that was called
 */
function getRequestUrl(ctx: ReturnType<typeof createTestContext>): string {
  assert.ok(ctx.discordClient.capturedPayloads.length > 0);
  return ctx.discordClient.capturedPayloads[0]!.url;
}

describe("Discord Payload Webhooks (e2e)", { concurrency: true }, () => {
  before(async () => {
    stores = await setupTestDatabase();
  });

  after(async () => {
    await teardownTestDatabase();
  });

  describe("Webhook Basic Delivery", () => {
    it("delivers to webhook with username", async () => {
      const ctx = createTestContext(stores);

      const eventWithWebhook = createEventWithWebhook(ctx.testFeedV2Event, {
        id: "webhook-123",
        token: "webhook-token-abc",
        name: "RSS Bot",
      });

      try {
        await ctx.seedArticles(eventWithWebhook);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "webhook-username-test",
                title: "Webhook Article",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithWebhook);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);
        assert.strictEqual(results![0]!.status, ArticleDeliveryStatus.PendingDelivery);

        const payload = getDiscordPayload(ctx);
        assert.strictEqual(payload.username, "RSS Bot");
      } finally {
        ctx.cleanup();
      }
    });

    it("delivers to webhook with username containing placeholders", async () => {
      const ctx = createTestContext(stores);

      const eventWithWebhook = createEventWithWebhook(ctx.testFeedV2Event, {
        id: "webhook-123",
        token: "webhook-token-abc",
        name: "{{author}} News",
      });

      try {
        await ctx.seedArticles(eventWithWebhook);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "webhook-username-placeholder-test",
                title: "Article Title",
                author: "TechBlog",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithWebhook);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);
        assert.strictEqual(payload.username, "TechBlog News");
      } finally {
        ctx.cleanup();
      }
    });

    it("delivers to webhook with avatar_url", async () => {
      const ctx = createTestContext(stores);

      const eventWithWebhook = createEventWithWebhook(ctx.testFeedV2Event, {
        id: "webhook-123",
        token: "webhook-token-abc",
        name: "RSS Bot",
        iconUrl: "https://example.com/avatar.png",
      });

      try {
        await ctx.seedArticles(eventWithWebhook);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "webhook-avatar-test",
                title: "Avatar Article",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithWebhook);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);
        assert.strictEqual(payload.avatar_url, "https://example.com/avatar.png");
      } finally {
        ctx.cleanup();
      }
    });

    it("delivers to webhook with avatar_url containing placeholders", async () => {
      const ctx = createTestContext(stores);

      // Use an extracted image from description HTML content
      const eventWithWebhook = createEventWithWebhook(ctx.testFeedV2Event, {
        id: "webhook-123",
        token: "webhook-token-abc",
        name: "RSS Bot",
        iconUrl: "{{extracted::description::image1}}",
      });

      try {
        await ctx.seedArticles(eventWithWebhook);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "webhook-avatar-placeholder-test",
                title: "Dynamic Avatar Article",
                description:
                  '<p>Article with image: <img src="https://example.com/dynamic-avatar.png" /></p>',
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithWebhook);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);
        assert.strictEqual(payload.avatar_url,
          "https://example.com/dynamic-avatar.png"
        );
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Webhook URL Construction", () => {
    it("constructs correct webhook URL", async () => {
      const ctx = createTestContext(stores);

      const eventWithWebhook = createEventWithWebhook(ctx.testFeedV2Event, {
        id: "webhook-456",
        token: "secret-token-xyz",
      });

      try {
        await ctx.seedArticles(eventWithWebhook);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "webhook-url-test",
                title: "URL Test Article",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        await ctx.handleEvent(eventWithWebhook);

        const url = getRequestUrl(ctx);
        assert.ok(url.includes("/webhooks/webhook-456/secret-token-xyz"));
      } finally {
        ctx.cleanup();
      }
    });

    it("constructs webhook URL with thread ID parameter", async () => {
      const ctx = createTestContext(stores);

      const eventWithWebhook = createEventWithWebhook(ctx.testFeedV2Event, {
        id: "webhook-789",
        token: "thread-token",
        type: "thread",
        threadId: "thread-123456",
      });

      try {
        await ctx.seedArticles(eventWithWebhook);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "webhook-thread-url-test",
                title: "Thread URL Test Article",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        await ctx.handleEvent(eventWithWebhook);

        const url = getRequestUrl(ctx);
        assert.ok(url.includes("thread_id=thread-123456"));
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Webhook with Content and Embeds", () => {
    it("delivers webhook message with content and embeds", async () => {
      const ctx = createTestContext(stores);

      const eventWithWebhook = createEventWithWebhook(
        ctx.testFeedV2Event,
        {
          id: "webhook-full",
          token: "full-token",
          name: "Full Webhook",
          iconUrl: "https://example.com/icon.png",
        },
        {
          content: "New article: {{title}}",
          embeds: [
            {
              title: "{{title}}",
              description: "{{description}}",
              color: 0x00ff00,
            },
          ],
        }
      );

      try {
        await ctx.seedArticles(eventWithWebhook);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "webhook-full-test",
                title: "Full Article",
                description: "Full description",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithWebhook);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);
        assert.strictEqual(payload.username, "Full Webhook");
        assert.strictEqual(payload.avatar_url, "https://example.com/icon.png");
        assert.strictEqual(payload.content, "New article: Full Article");
        assert.ok(Array.isArray(payload.embeds));
        assert.strictEqual(payload.embeds[0].title, "Full Article");
        assert.strictEqual(payload.embeds[0].description, "Full description");
        assert.strictEqual(payload.embeds[0].color, 0x00ff00);
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Webhook without optional fields", () => {
    it("delivers webhook message without username when not specified", async () => {
      const ctx = createTestContext(stores);

      const eventWithWebhook = createEventWithWebhook(ctx.testFeedV2Event, {
        id: "webhook-minimal",
        token: "minimal-token",
      });

      try {
        await ctx.seedArticles(eventWithWebhook);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "webhook-minimal-test",
                title: "Minimal Webhook Article",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithWebhook);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);

        const payload = getDiscordPayload(ctx);
        // Username should be undefined or empty when not specified
        assert.ok(!payload.username);
        assert.ok(!payload.avatar_url);
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Webhook with Components V2", () => {
    it("delivers webhook message with componentsV2 and username/avatar_url", async () => {
      const ctx = createTestContext(stores);

      const componentsV2: ComponentV2Input[] = [
        {
          type: "SECTION",
          components: [
            {
              type: "TEXT_DISPLAY",
              content: "Article: {{title}}",
            },
          ],
          accessory: {
            type: "BUTTON",
            style: 5,
            label: "Read",
            url: "{{link}}",
          },
        },
      ];

      // Create event with webhook AND componentsV2
      const baseEventWithWebhook = createEventWithWebhook(ctx.testFeedV2Event, {
        id: "webhook-v2",
        token: "v2-token",
        name: "V2 Bot",
        iconUrl: "https://example.com/v2-avatar.png",
      });

      // Add componentsV2 to the event
      const eventWithV2: FeedV2Event = {
        ...baseEventWithWebhook,
        data: {
          ...baseEventWithWebhook.data,
          mediums: [
            {
              ...baseEventWithWebhook.data.mediums[0]!,
              details: {
                ...baseEventWithWebhook.data.mediums[0]!.details,
                componentsV2: componentsV2 as MediumDetails["componentsV2"],
              },
            },
          ],
        },
      };

      try {
        await ctx.seedArticles(eventWithV2);

        ctx.setFeedResponse(() => ({
          body: getTestRssFeed(
            [
              {
                guid: "webhook-v2-components-test",
                title: "V2 Components Article",
                link: "https://example.com/v2",
              },
            ],
            true
          ),
          hash: randomUUID(),
        }));

        const results = await ctx.handleEvent(eventWithV2);

        assert.notStrictEqual(results, null);
        assert.strictEqual(results!.length, 1);
        assert.strictEqual(results![0]!.status, ArticleDeliveryStatus.PendingDelivery);

        const payload = getDiscordPayload(ctx);

        // Verify username and avatar_url are set correctly
        assert.strictEqual(payload.username, "V2 Bot");
        assert.strictEqual(payload.avatar_url, "https://example.com/v2-avatar.png");

        // Verify componentsV2 are also present
        assert.ok(Array.isArray(payload.components));
        assert.ok(payload.components.length > 0);
      } finally {
        ctx.cleanup();
      }
    });
  });
});

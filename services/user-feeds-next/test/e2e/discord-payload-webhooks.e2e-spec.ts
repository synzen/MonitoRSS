import { describe, it, expect } from "bun:test";
import { randomUUID } from "crypto";
import { ArticleDeliveryStatus } from "../../src/delivery";
import getTestRssFeed from "../data/test-rss-feed";
import { createTestContext } from "../helpers/test-context";
import type { FeedV2Event, EmbedInput } from "../../src/shared/schemas";

// Note: Test infrastructure setup/teardown is handled by test/setup.ts (preload file)

type MediumDetails = FeedV2Event["data"]["mediums"][0]["details"];

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
  expect(ctx.discordClient.capturedPayloads.length).toBeGreaterThan(0);
  return JSON.parse(
    ctx.discordClient.capturedPayloads[0]!.options.body as string
  );
}

/**
 * Helper to get the URL that was called
 */
function getRequestUrl(ctx: ReturnType<typeof createTestContext>): string {
  expect(ctx.discordClient.capturedPayloads.length).toBeGreaterThan(0);
  return ctx.discordClient.capturedPayloads[0]!.url;
}

describe("Discord Payload Webhooks (e2e)", () => {
  describe("Webhook Basic Delivery", () => {
    it("delivers to webhook with username", async () => {
      const ctx = createTestContext();

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

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);
        expect(results![0]!.status).toBe(ArticleDeliveryStatus.PendingDelivery);

        const payload = getDiscordPayload(ctx);
        expect(payload.username).toBe("RSS Bot");
      } finally {
        ctx.cleanup();
      }
    });

    it("delivers to webhook with username containing placeholders", async () => {
      const ctx = createTestContext();

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

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);

        const payload = getDiscordPayload(ctx);
        expect(payload.username).toBe("TechBlog News");
      } finally {
        ctx.cleanup();
      }
    });

    it("delivers to webhook with avatar_url", async () => {
      const ctx = createTestContext();

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

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);

        const payload = getDiscordPayload(ctx);
        expect(payload.avatar_url).toBe("https://example.com/avatar.png");
      } finally {
        ctx.cleanup();
      }
    });

    it("delivers to webhook with avatar_url containing placeholders", async () => {
      const ctx = createTestContext();

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

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);

        const payload = getDiscordPayload(ctx);
        expect(payload.avatar_url).toBe(
          "https://example.com/dynamic-avatar.png"
        );
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Webhook URL Construction", () => {
    it("constructs correct webhook URL", async () => {
      const ctx = createTestContext();

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
        expect(url).toContain("/webhooks/webhook-456/secret-token-xyz");
      } finally {
        ctx.cleanup();
      }
    });

    it("constructs webhook URL with thread ID parameter", async () => {
      const ctx = createTestContext();

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
        expect(url).toContain("thread_id=thread-123456");
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Webhook with Content and Embeds", () => {
    it("delivers webhook message with content and embeds", async () => {
      const ctx = createTestContext();

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

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);

        const payload = getDiscordPayload(ctx);
        expect(payload.username).toBe("Full Webhook");
        expect(payload.avatar_url).toBe("https://example.com/icon.png");
        expect(payload.content).toBe("New article: Full Article");
        expect(payload.embeds).toBeArray();
        expect(payload.embeds[0].title).toBe("Full Article");
        expect(payload.embeds[0].description).toBe("Full description");
        expect(payload.embeds[0].color).toBe(0x00ff00);
      } finally {
        ctx.cleanup();
      }
    });
  });

  describe("Webhook without optional fields", () => {
    it("delivers webhook message without username when not specified", async () => {
      const ctx = createTestContext();

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

        expect(results).not.toBeNull();
        expect(results!.length).toBe(1);

        const payload = getDiscordPayload(ctx);
        // Username should be undefined or empty when not specified
        expect(payload.username).toBeFalsy();
        expect(payload.avatar_url).toBeFalsy();
      } finally {
        ctx.cleanup();
      }
    });
  });
});

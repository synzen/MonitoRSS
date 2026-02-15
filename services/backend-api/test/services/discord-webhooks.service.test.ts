import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";
import { DiscordWebhooksService } from "../../src/services/discord-webhooks/discord-webhooks.service";
import { DiscordWebhookType } from "../../src/shared/types/discord.types";
import { DiscordAPIError } from "../../src/shared/exceptions/discord-api.error";
import { WebhookMissingPermissionsException } from "../../src/shared/exceptions/discord-webhooks.exceptions";
import type { Config } from "../../src/config";
import type { DiscordApiService } from "../../src/services/discord-api/discord-api.service";

describe("DiscordWebhooksService", { concurrency: true }, () => {
  const clientId = "client-123";
  const mockConfig = {
    BACKEND_API_DISCORD_CLIENT_ID: clientId,
  } as Config;

  const createMockDiscordApiService = (
    overrides: Record<string, unknown> = {},
  ) =>
    ({
      executeBotRequest: mock.fn(),
      ...overrides,
    }) as unknown as DiscordApiService;

  describe("canBeUsedByBot", () => {
    let service: DiscordWebhooksService;

    beforeEach(() => {
      service = new DiscordWebhooksService(
        mockConfig,
        createMockDiscordApiService(),
      );
    });

    it("returns true for INCOMING webhook with null application_id", () => {
      const webhook = {
        id: "webhook-123",
        type: DiscordWebhookType.INCOMING,
        channel_id: "channel-123",
        name: "Test Webhook",
        application_id: null,
      };

      const result = service.canBeUsedByBot(webhook);

      assert.strictEqual(result, true);
    });

    it("returns true for INCOMING webhook owned by this application", () => {
      const webhook = {
        id: "webhook-123",
        type: DiscordWebhookType.INCOMING,
        channel_id: "channel-123",
        name: "Test Webhook",
        application_id: clientId,
      };

      const result = service.canBeUsedByBot(webhook);

      assert.strictEqual(result, true);
    });

    it("returns false for INCOMING webhook owned by different application", () => {
      const webhook = {
        id: "webhook-123",
        type: DiscordWebhookType.INCOMING,
        channel_id: "channel-123",
        name: "Test Webhook",
        application_id: "other-app-id",
      };

      const result = service.canBeUsedByBot(webhook);

      assert.strictEqual(result, false);
    });

    it("returns false for non-INCOMING webhook types", () => {
      const webhook = {
        id: "webhook-123",
        type: DiscordWebhookType.CHANNEL_FOLLOWER,
        channel_id: "channel-123",
        name: "Test Webhook",
        application_id: null,
      };

      const result = service.canBeUsedByBot(webhook);

      assert.strictEqual(result, false);
    });

    it("returns true with onlyApplicationOwned filter when owned by this app", () => {
      const webhook = {
        id: "webhook-123",
        type: DiscordWebhookType.INCOMING,
        channel_id: "channel-123",
        name: "Test Webhook",
        application_id: clientId,
      };

      const result = service.canBeUsedByBot(webhook, {
        onlyApplicationOwned: true,
      });

      assert.strictEqual(result, true);
    });

    it("returns false with onlyApplicationOwned filter for null application_id", () => {
      const webhook = {
        id: "webhook-123",
        type: DiscordWebhookType.INCOMING,
        channel_id: "channel-123",
        name: "Test Webhook",
        application_id: null,
      };

      const result = service.canBeUsedByBot(webhook, {
        onlyApplicationOwned: true,
      });

      assert.strictEqual(result, false);
    });
  });

  describe("createWebhook", () => {
    it("creates a webhook and returns it", async () => {
      const createdWebhook = {
        id: "webhook-123",
        type: DiscordWebhookType.INCOMING,
        channel_id: "channel-123",
        name: "Test Webhook",
      };
      const mockDiscordApiService = createMockDiscordApiService({
        executeBotRequest: mock.fn(() => Promise.resolve(createdWebhook)),
      });
      const service = new DiscordWebhooksService(
        mockConfig,
        mockDiscordApiService,
      );

      const result = await service.createWebhook("channel-123", {
        name: "Test Webhook",
      });

      assert.deepStrictEqual(result, createdWebhook);
    });
  });

  describe("getWebhooksOfChannel", () => {
    it("returns filtered webhooks", async () => {
      const webhooks = [
        {
          id: "webhook-1",
          type: DiscordWebhookType.INCOMING,
          channel_id: "channel-123",
          name: "Webhook 1",
          application_id: null,
        },
        {
          id: "webhook-2",
          type: DiscordWebhookType.CHANNEL_FOLLOWER,
          channel_id: "channel-123",
          name: "Webhook 2",
          application_id: null,
        },
      ];
      const mockDiscordApiService = createMockDiscordApiService({
        executeBotRequest: mock.fn(() => Promise.resolve(webhooks)),
      });
      const service = new DiscordWebhooksService(
        mockConfig,
        mockDiscordApiService,
      );

      const result = await service.getWebhooksOfChannel("channel-123");

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0]?.id, "webhook-1");
    });

    it("throws WebhookMissingPermissionsException on 403", async () => {
      const mockDiscordApiService = createMockDiscordApiService({
        executeBotRequest: mock.fn(() =>
          Promise.reject(new DiscordAPIError("Forbidden", 403)),
        ),
      });
      const service = new DiscordWebhooksService(
        mockConfig,
        mockDiscordApiService,
      );

      await assert.rejects(
        () => service.getWebhooksOfChannel("channel-123"),
        WebhookMissingPermissionsException,
      );
    });

    it("rethrows other errors", async () => {
      const mockDiscordApiService = createMockDiscordApiService({
        executeBotRequest: mock.fn(() =>
          Promise.reject(new DiscordAPIError("Server Error", 500)),
        ),
      });
      const service = new DiscordWebhooksService(
        mockConfig,
        mockDiscordApiService,
      );

      await assert.rejects(
        () => service.getWebhooksOfChannel("channel-123"),
        DiscordAPIError,
      );
    });
  });

  describe("getWebhook", () => {
    it("returns webhook when found", async () => {
      const webhook = {
        id: "webhook-123",
        type: DiscordWebhookType.INCOMING,
        channel_id: "channel-123",
        name: "Test Webhook",
      };
      const mockDiscordApiService = createMockDiscordApiService({
        executeBotRequest: mock.fn(() => Promise.resolve(webhook)),
      });
      const service = new DiscordWebhooksService(
        mockConfig,
        mockDiscordApiService,
      );

      const result = await service.getWebhook("webhook-123");

      assert.deepStrictEqual(result, webhook);
    });

    it("returns null on 404", async () => {
      const mockDiscordApiService = createMockDiscordApiService({
        executeBotRequest: mock.fn(() =>
          Promise.reject(new DiscordAPIError("Not Found", 404)),
        ),
      });
      const service = new DiscordWebhooksService(
        mockConfig,
        mockDiscordApiService,
      );

      const result = await service.getWebhook("webhook-123");

      assert.strictEqual(result, null);
    });

    it("rethrows other errors", async () => {
      const mockDiscordApiService = createMockDiscordApiService({
        executeBotRequest: mock.fn(() =>
          Promise.reject(new DiscordAPIError("Server Error", 500)),
        ),
      });
      const service = new DiscordWebhooksService(
        mockConfig,
        mockDiscordApiService,
      );

      await assert.rejects(
        () => service.getWebhook("webhook-123"),
        DiscordAPIError,
      );
    });
  });

  describe("deleteWebhook", () => {
    it("deletes webhook successfully", async () => {
      const mockDiscordApiService = createMockDiscordApiService({
        executeBotRequest: mock.fn(() => Promise.resolve(undefined)),
      });
      const service = new DiscordWebhooksService(
        mockConfig,
        mockDiscordApiService,
      );

      await service.deleteWebhook("webhook-123");

      const mockFn =
        mockDiscordApiService.executeBotRequest as unknown as ReturnType<
          typeof mock.fn
        >;
      assert.strictEqual(mockFn.mock.calls.length, 1);
    });

    it("silently succeeds on 404", async () => {
      const mockDiscordApiService = createMockDiscordApiService({
        executeBotRequest: mock.fn(() =>
          Promise.reject(new DiscordAPIError("Not Found", 404)),
        ),
      });
      const service = new DiscordWebhooksService(
        mockConfig,
        mockDiscordApiService,
      );

      await service.deleteWebhook("webhook-123");
    });

    it("rethrows other errors", async () => {
      const mockDiscordApiService = createMockDiscordApiService({
        executeBotRequest: mock.fn(() =>
          Promise.reject(new DiscordAPIError("Server Error", 500)),
        ),
      });
      const service = new DiscordWebhooksService(
        mockConfig,
        mockDiscordApiService,
      );

      await assert.rejects(
        () => service.deleteWebhook("webhook-123"),
        DiscordAPIError,
      );
    });
  });
});

import { ConfigService } from "@nestjs/config";
import { DiscordAPIError } from "../../common/errors/DiscordAPIError";
import { DiscordAPIService } from "../../services/apis/discord/discord-api.service";
import { DiscordWebhooksService } from "./discord-webhooks.service";
import {
  DiscordWebhook,
  DiscordWebhookType,
} from "./types/discord-webhook.type";

describe("DiscordWebhooksService", () => {
  let service: DiscordWebhooksService;
  let discordApiService: DiscordAPIService;
  let configService: ConfigService;
  const botClientId = "bot-client-id";

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    } as never;
    discordApiService = new DiscordAPIService(configService);

    service = new DiscordWebhooksService(discordApiService, configService);
    service.clientId = botClientId;
  });

  describe("getWebhooksOfServer", () => {
    it("should return the incoming webhooks of server", async () => {
      const serverId = "serverId";
      const webhooks: DiscordWebhook[] = [
        {
          id: "12345",
          type: DiscordWebhookType.INCOMING,
          channel_id: "12345",
          application_id: botClientId,
          name: "test",
        },
        {
          id: "12345",
          type: DiscordWebhookType.INCOMING,
          channel_id: "12345",
          application_id: botClientId,
          name: "test2",
        },
      ];

      jest
        .spyOn(discordApiService, "executeBotRequest")
        .mockResolvedValue(webhooks);

      const result = await service.getWebhooksOfServer(serverId);

      expect(result).toEqual(webhooks);
    });
    it('does not return webhooks that are not of type "incoming"', async () => {
      const serverId = "serverId";
      const webhooks: DiscordWebhook[] = [
        {
          id: "12345",
          type: DiscordWebhookType.APPLICATION,
          channel_id: "12345",
          application_id: botClientId,
          name: "test",
        },
        {
          id: "12345",
          type: DiscordWebhookType.CHANNEL_FOLLOWER,
          channel_id: "12345",
          application_id: botClientId,
          name: "test2",
        },
      ];

      jest
        .spyOn(discordApiService, "executeBotRequest")
        .mockResolvedValue(webhooks);

      const result = await service.getWebhooksOfServer(serverId);

      expect(result).toEqual([]);
    });
    it("does not return webhooks whose application id is not the bot's", async () => {
      const serverId = "serverId";
      const webhooks: DiscordWebhook[] = [
        {
          id: "12345",
          type: DiscordWebhookType.INCOMING,
          channel_id: "12345",
          application_id: botClientId + "1",
          name: "test",
        },
      ];

      jest
        .spyOn(discordApiService, "executeBotRequest")
        .mockResolvedValue(webhooks);

      const result = await service.getWebhooksOfServer(serverId);

      expect(result).toEqual([]);
    });
    it("does return webhooks whose application id is null", async () => {
      const serverId = "serverId";
      const webhooks: DiscordWebhook[] = [
        {
          id: "12345",
          type: DiscordWebhookType.INCOMING,
          channel_id: "12345",
          application_id: null,
          name: "test",
        },
      ];

      jest
        .spyOn(discordApiService, "executeBotRequest")
        .mockResolvedValue(webhooks);

      const result = await service.getWebhooksOfServer(serverId);

      expect(result).toEqual(webhooks);
    });
  });

  describe("getWebhook", () => {
    it("returns the webhook", async () => {
      const webhookId = "webhookId";
      const webhook: DiscordWebhook = {
        id: "12345",
        type: DiscordWebhookType.INCOMING,
        channel_id: "12345",
        application_id: botClientId,
        name: "test",
      };

      jest
        .spyOn(discordApiService, "executeBotRequest")
        .mockResolvedValue(webhook);

      const result = await service.getWebhook(webhookId);

      expect(result).toEqual(webhook);
    });
    it("returns null if the webhook does not exist", async () => {
      const webhookId = "webhookId";

      jest
        .spyOn(discordApiService, "executeBotRequest")
        .mockRejectedValue(new DiscordAPIError("webhook not found", 404));

      const result = await service.getWebhook(webhookId);

      expect(result).toBeNull();
    });
    it("throws an unhandled error", async () => {
      const webhookId = "webhookId";
      const err = new Error("unhandled error");

      jest.spyOn(discordApiService, "executeBotRequest").mockRejectedValue(err);

      await expect(service.getWebhook(webhookId)).rejects.toThrow(err);
    });
  });

  describe("canBeUsedByBot", () => {
    it("returns true correctly", () => {
      const webhook: DiscordWebhook = {
        id: "12345",
        type: DiscordWebhookType.INCOMING,
        channel_id: "12345",
        application_id: botClientId,
        name: "test",
      };

      const result = service.canBeUsedByBot(webhook);

      expect(result).toBe(true);
    });

    it("returns false if the webhook is not of type incoming", () => {
      const webhook: DiscordWebhook = {
        id: "12345",
        type: DiscordWebhookType.APPLICATION,
        channel_id: "12345",
        application_id: botClientId,
        name: "test",
      };

      const result = service.canBeUsedByBot(webhook);

      expect(result).toBe(false);
    });

    it("returns false if the webhook's application id is not the bot's", () => {
      const webhook: DiscordWebhook = {
        id: "12345",
        type: DiscordWebhookType.INCOMING,
        channel_id: "12345",
        application_id: botClientId + "1",
        name: "test",
      };

      const result = service.canBeUsedByBot(webhook);

      expect(result).toBe(false);
    });

    it("returns true if the webhook's application id is null", () => {
      const webhook: DiscordWebhook = {
        id: "12345",
        type: DiscordWebhookType.INCOMING,
        channel_id: "12345",
        application_id: null,
        name: "test",
      };

      const result = service.canBeUsedByBot(webhook);

      expect(result).toBe(true);
    });
  });
});

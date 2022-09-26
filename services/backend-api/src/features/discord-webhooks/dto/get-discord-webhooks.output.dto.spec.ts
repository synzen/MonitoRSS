import { DiscordWebhook } from "../types/discord-webhook.type";
import { GetDiscordWebhooksOutputDto } from "./get-discord-webhooks.output.dto";

describe("GetDiscordWebhooksOutputDto", () => {
  describe("static fromEntity", () => {
    it("returns correctly", () => {
      const webhooks: DiscordWebhook[] = [
        {
          channel_id: "channel-id",
          id: "id",
          name: "name",
          type: 1,
          application_id: "application-id",
        },
      ];

      const result = GetDiscordWebhooksOutputDto.fromEntities(webhooks);

      expect(result).toEqual({
        results: [
          {
            id: "id",
            channelId: "channel-id",
            avatarUrl: undefined,
            name: "name",
          },
        ],
      });
    });
    it("coerces avatar into undefined", () => {
      const webhooks: DiscordWebhook[] = [
        {
          channel_id: "channel-id",
          id: "id",
          name: "name",
          type: 1,
          application_id: "application-id",
          avatar: null,
        },
      ];

      const result = GetDiscordWebhooksOutputDto.fromEntities(webhooks);

      expect(result).toEqual({
        results: [
          {
            id: "id",
            channelId: "channel-id",
            avatarUrl: undefined,
            name: "name",
          },
        ],
      });
    });
  });
});

import { Types } from "mongoose";
import { FeedConnectionType } from "../feeds/constants";
import { FeedConnectionsDiscordWebhooksService } from "./feed-connections-discord-webhooks.service";
// eslint-disable-next-line max-len
import { FeedConnectionsDiscordWebhooksController } from "./feed-connections-discord-webhooks.controller";

describe("FeedConnectionsController", () => {
  let feedConnectionsDiscordWebhooksService: FeedConnectionsDiscordWebhooksService;
  let controller: FeedConnectionsDiscordWebhooksController;

  beforeEach(async () => {
    jest.resetAllMocks();
    feedConnectionsDiscordWebhooksService = {
      createDiscordChannelConnection: jest.fn(),
      createDiscordWebhookConnection: jest.fn(),
    } as never;
    controller = new FeedConnectionsDiscordWebhooksController(
      feedConnectionsDiscordWebhooksService
    );
  });

  describe("createDiscordWebhookConnection", () => {
    it("returns the discord webhook connection", async () => {
      const name = "name";
      const accessToken = "accessToken";
      const connection = {
        id: new Types.ObjectId(),
        name,
        filters: {
          expression: {},
        },
        details: {
          type: FeedConnectionType.DiscordWebhook,
          webhook: {
            id: "id",
            name: "name",
            iconUrl: "iconurl",
            token: "token",
          },
          embeds: [],
          content: "content",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest
        .spyOn(
          feedConnectionsDiscordWebhooksService,
          "createDiscordWebhookConnection"
        )
        .mockResolvedValue(connection);

      const result = await controller.createDiscordWebhookConnection(
        {
          _id: new Types.ObjectId(),
        } as never,
        {
          webhook: {
            id: "id",
            iconUrl: "iconurl",
            name: "name",
          },
          name,
        },
        {
          access_token: accessToken,
        } as never
      );

      expect(result).toEqual({
        id: connection.id.toHexString(),
        name: connection.name,
        key: FeedConnectionType.DiscordWebhook,
        filters: {
          expression: {},
        },
        details: {
          webhook: {
            id: connection.details.webhook.id,
            name: connection.details.webhook.name,
            iconUrl: connection.details.webhook.iconUrl,
          },
          embeds: connection.details.embeds,
          content: connection.details.content,
        },
      });
    });
  });
});

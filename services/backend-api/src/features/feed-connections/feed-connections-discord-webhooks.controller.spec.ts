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
      createDiscordWebhookConnection: jest.fn(),
      updateDiscordWebhookConnection: jest.fn(),
      deleteDiscordWebhookConnection: jest.fn(),
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

  describe("updateDiscordWebhookConnection", () => {
    it("returns the updated discord webhook connection", async () => {
      const name = "name";
      const connectionId = new Types.ObjectId();
      const connection = {
        id: connectionId,
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
          "updateDiscordWebhookConnection"
        )
        .mockResolvedValue(connection);

      const result = await controller.updateDiscordWebhookConnection(
        {
          feed: {
            _id: new Types.ObjectId(),
          },
          connection: {
            id: connectionId,
          },
        } as never,
        {
          webhook: {
            id: "id",
            iconUrl: "iconurl",
            name: "name",
          },
          name,
        }
      );

      expect(result).toEqual({
        id: connectionId.toHexString(),
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

    it("does not pass webhook if there is no webhook object", async () => {
      const name = "name";
      const feedId = new Types.ObjectId();
      const connectionId = new Types.ObjectId();
      const guildId = "guildId";
      const connection = {
        id: connectionId,
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

      const updateSpy = jest
        .spyOn(
          feedConnectionsDiscordWebhooksService,
          "updateDiscordWebhookConnection"
        )
        .mockResolvedValue(connection);

      await controller.updateDiscordWebhookConnection(
        {
          feed: {
            _id: feedId,
            guild: guildId,
          },
          connection: {
            id: connectionId,
          },
        } as never,
        {
          name,
        }
      );

      expect(updateSpy).toHaveBeenCalledWith({
        feedId: feedId.toHexString(),
        connectionId: connectionId.toHexString(),
        guildId,
        updates: {
          name,
          filters: undefined,
          details: {
            content: undefined,
            embeds: undefined,
            webhook: undefined,
          },
        },
      });
    });
  });

  describe("deleteDiscordWebhookConnection", () => {
    const feedId = new Types.ObjectId();
    const connectionId = new Types.ObjectId();

    it("deletes the discord webhook connection", async () => {
      const deleteSpy = jest.spyOn(
        feedConnectionsDiscordWebhooksService,
        "deleteDiscordWebhookConnection"
      );

      await controller.deleteDiscordWebhookConnection({
        feed: {
          _id: feedId,
        },
        connection: {
          id: connectionId,
        },
      } as never);

      expect(deleteSpy).toHaveBeenCalledWith({
        feedId: feedId.toHexString(),
        connectionId: connectionId.toHexString(),
      });
    });

    it("returns undefined", async () => {
      jest.spyOn(
        feedConnectionsDiscordWebhooksService,
        "deleteDiscordWebhookConnection"
      );

      const result = await controller.deleteDiscordWebhookConnection({
        feed: {
          _id: feedId,
        },
        connection: {
          id: connectionId,
        },
      } as never);

      expect(result).toBeUndefined();
    });
  });
});

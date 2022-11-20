import { Types } from "mongoose";
import { FeedConnectionType } from "../feeds/constants";
import { FeedConnectionsDiscordWebhooksService } from "./feed-connections-discord-webhooks.service";
// eslint-disable-next-line max-len
import { FeedConnectionsDiscordWebhooksController } from "./feed-connections-discord-webhooks.controller";
import { FeedEmbed } from "../feeds/entities/feed-embed.entity";

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
            guildId: "guild",
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
            guildId: connection.details.webhook.guildId,
          },
          embeds: connection.details.embeds,
          content: connection.details.content,
        },
      });
    });
  });

  describe("updateDiscordWebhookConnection", () => {
    const accessToken = "access-token";

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
            guildId: "guild",
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
        },
        {
          access_token: accessToken,
        } as never
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
            guildId: connection.details.webhook.guildId,
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
            guildId: "guild",
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
        },
        {
          access_token: accessToken,
        } as never
      );

      expect(updateSpy).toHaveBeenCalledWith({
        accessToken,
        feedId: feedId.toHexString(),
        connectionId: connectionId.toHexString(),
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

    it("flattens the input embed before passing it to the service", async () => {
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
            guildId: "guild",
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
          embeds: [
            {
              title: "title",
              description: "description",
              url: "url",
              color: "0",
              timestamp: "now",
              footer: {
                text: "footerText",
                iconUrl: "footerIconUrl",
              },
              image: {
                url: "imageUrl",
              },
              thumbnail: {
                url: "thumbnailUrl",
              },
              author: {
                name: "authorName",
                iconUrl: "authorIconUrl",
                url: "authorUrl",
              },
              fields: [
                {
                  name: "fieldName",
                  value: "fieldValue",
                  inline: true,
                },
              ],
            },
          ],
        },
        {
          access_token: accessToken,
        } as never
      );

      const expectedEmbed: FeedEmbed = {
        title: "title",
        description: "description",
        url: "url",
        color: "0",
        timestamp: "now",
        footerText: "footerText",
        footerIconURL: "footerIconUrl",
        imageURL: "imageUrl",
        thumbnailURL: "thumbnailUrl",
        authorName: "authorName",
        authorIconURL: "authorIconUrl",
        authorURL: "authorUrl",
        fields: [
          {
            name: "fieldName",
            value: "fieldValue",
            inline: true,
          },
        ],
      };

      expect(updateSpy).toHaveBeenCalledWith({
        accessToken,
        feedId: feedId.toHexString(),
        connectionId: connectionId.toHexString(),
        updates: {
          name: undefined,
          filters: undefined,
          details: {
            content: undefined,
            embeds: [expectedEmbed],
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

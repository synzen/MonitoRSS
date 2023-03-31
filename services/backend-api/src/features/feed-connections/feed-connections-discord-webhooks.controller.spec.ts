/* eslint-disable max-len */
import { Types } from "mongoose";
import {
  FeedConnectionDisabledCode,
  FeedConnectionType,
} from "../feeds/constants";
import { FeedConnectionsDiscordWebhooksService } from "./feed-connections-discord-webhooks.service";
// eslint-disable-next-line max-len
import { FeedConnectionsDiscordWebhooksController } from "./feed-connections-discord-webhooks.controller";
import { FeedEmbed } from "../feeds/entities/feed-embed.entity";
import { TestDeliveryStatus } from "../../services/feed-handler/constants";
import { CannotEnableAutoDisabledConnection } from "../../common/exceptions";

describe("FeedConnectionsController", () => {
  let feedConnectionsDiscordWebhooksService: FeedConnectionsDiscordWebhooksService;
  let controller: FeedConnectionsDiscordWebhooksController;

  beforeEach(async () => {
    jest.resetAllMocks();
    feedConnectionsDiscordWebhooksService = {
      createDiscordWebhookConnection: jest.fn(),
      updateDiscordWebhookConnection: jest.fn(),
      deleteDiscordWebhookConnection: jest.fn(),
      sendTestArticle: jest.fn(),
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
        splitOptions: {
          splitChar: "s",
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
        splitOptions: {
          splitChar: "s",
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

  describe("sendTestArticle", () => {
    it("returns correctly", async () => {
      jest
        .spyOn(feedConnectionsDiscordWebhooksService, "sendTestArticle")
        .mockResolvedValue({
          status: TestDeliveryStatus.Success,
        });

      const response = await controller.sendTestArticle(
        {
          feed: {} as never,
          connection: {} as never,
        },
        {} as never
      );

      expect(response).toEqual({
        result: {
          status: TestDeliveryStatus.Success,
        },
      });
    });
  });

  describe("updateDiscordWebhookConnection", () => {
    const name = "name";
    const guildId = "guildId";
    const feedId = new Types.ObjectId();
    const connectionId = new Types.ObjectId();
    const accessToken = "access-token";
    const mockConnection = {
      id: connectionId,
      name,
      filters: {
        expression: {},
      },
      splitOptions: {
        splitChar: "s",
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
    let updateSpy: jest.SpyInstance;

    beforeEach(() => {
      updateSpy = jest
        .spyOn(
          feedConnectionsDiscordWebhooksService,
          "updateDiscordWebhookConnection"
        )
        .mockResolvedValue(mockConnection);
    });

    it("returns the updated discord webhook connection", async () => {
      const result = await controller.updateDiscordWebhookConnection(
        {
          feed: {
            _id: feedId,
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
        name: mockConnection.name,
        key: FeedConnectionType.DiscordWebhook,
        filters: {
          expression: {},
        },
        splitOptions: {
          splitChar: "s",
        },
        details: {
          webhook: {
            id: mockConnection.details.webhook.id,
            name: mockConnection.details.webhook.name,
            iconUrl: mockConnection.details.webhook.iconUrl,
            guildId: mockConnection.details.webhook.guildId,
          },
          embeds: mockConnection.details.embeds,
          content: mockConnection.details.content,
        },
      });
    });

    it("does not pass webhook if there is no webhook object", async () => {
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

    it("sets disabledCode to null if content is updated", async () => {
      await controller.updateDiscordWebhookConnection(
        {
          feed: {
            _id: feedId,
            guild: guildId,
          },
          connection: {
            id: connectionId,
            disabledCode: FeedConnectionDisabledCode.BadFormat,
          },
        } as never,
        {
          content: "hello world",
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
          name: undefined,
          disabledCode: null,
          filters: undefined,
          details: {
            content: "hello world",
            embeds: undefined,
            webhook: undefined,
          },
        },
      });
    });

    it("sets webhook to current webhook if webhook is currently disabled because of missing permissions", async () => {
      await controller.updateDiscordWebhookConnection(
        {
          feed: {
            _id: feedId,
            guild: guildId,
          },
          connection: {
            id: connectionId,
            disabledCode: FeedConnectionDisabledCode.MissingPermissions,
            details: {
              webhook: {
                id: "id",
                name: "name",
                iconUrl: "iconurl",
              },
            },
          },
        } as never,
        {
          disabledCode: null,
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
          name: undefined,
          disabledCode: null,
          filters: undefined,
          details: {
            content: undefined,
            embeds: undefined,
            webhook: {
              id: "id",
              iconUrl: "iconurl",
              name: "name",
            },
          },
        },
      });
    });

    it("throws if attempting to enable feed for unhandled disabled code", async () => {
      await expect(
        controller.updateDiscordWebhookConnection(
          {
            feed: {
              _id: feedId,
              guild: guildId,
            },
            connection: {
              id: connectionId,
              disabledCode: FeedConnectionDisabledCode.Unknown,
              details: {
                webhook: {
                  id: "id",
                  name: "name",
                  iconUrl: "iconurl",
                },
              },
            },
          } as never,
          {
            disabledCode: null,
          },
          {
            access_token: accessToken,
          } as never
        )
      ).rejects.toThrow(CannotEnableAutoDisabledConnection);
    });

    it("throws if attempting to enable when feed has a bad format", async () => {
      await expect(
        controller.updateDiscordWebhookConnection(
          {
            feed: {
              _id: feedId,
              guild: guildId,
            },
            connection: {
              id: connectionId,
              disabledCode: FeedConnectionDisabledCode.BadFormat,
            },
          } as never,
          {
            disabledCode: null,
          },
          {
            access_token: "accessToken",
          } as never
        )
      ).rejects.toThrowError(CannotEnableAutoDisabledConnection);
    });

    it("sets disabledCode to null if embed is updated", async () => {
      await controller.updateDiscordWebhookConnection(
        {
          feed: {
            _id: feedId,
            guild: guildId,
          },
          connection: {
            id: connectionId,
            disabledCode: FeedConnectionDisabledCode.BadFormat,
          },
        } as never,
        {
          embeds: [],
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
          name: undefined,
          disabledCode: null,
          filters: undefined,
          details: {
            content: undefined,
            embeds: [],
            webhook: undefined,
          },
        },
      });
    });

    it("flattens the input embed before passing it to the service", async () => {
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

    it("allows connection to be disabled when disable code is manual", async () => {
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
          disabledCode: FeedConnectionDisabledCode.Manual,
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
          name: undefined,
          disabledCode: FeedConnectionDisabledCode.Manual,
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

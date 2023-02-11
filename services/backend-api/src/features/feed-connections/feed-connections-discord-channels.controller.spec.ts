/* eslint-disable max-len */
import { Types } from "mongoose";
import {
  FeedConnectionDisabledCode,
  FeedConnectionType,
} from "../feeds/constants";
import { FeedConnectionsDiscordChannelsService } from "./feed-connections-discord-channels.service";
// eslint-disable-next-line max-len
import { FeedConnectionsDiscordChannelsController } from "./feed-connections-discord-channels.controller";
import { FeedEmbed } from "../feeds/entities/feed-embed.entity";
import { TestDeliveryStatus } from "../../services/feed-handler/constants";
import { CannotEnableAutoDisabledConnection } from "../../common/exceptions";

describe("FeedConnectionsDiscordChannelsController", () => {
  let feedConnectionsDiscordChannelsService: FeedConnectionsDiscordChannelsService;
  let controller: FeedConnectionsDiscordChannelsController;

  beforeEach(async () => {
    jest.resetAllMocks();
    feedConnectionsDiscordChannelsService = {
      createDiscordChannelConnection: jest.fn(),
      updateDiscordChannelConnection: jest.fn(),
      deleteConnection: jest.fn(),
      sendTestArticle: jest.fn(),
    } as never;
    controller = new FeedConnectionsDiscordChannelsController(
      feedConnectionsDiscordChannelsService
    );
  });

  describe("createDiscordChannelConnection", () => {
    it("returns the discord channel connection", async () => {
      const channelId = "channelId";
      const guildId = "guildId";
      const name = "name";
      const accessToken = "accessToken";
      const connection = {
        id: new Types.ObjectId(),
        name,
        filters: {
          expression: {},
        },
        details: {
          formatter: {
            formatTables: true,
            stripImages: true,
          },
          channel: {
            id: channelId,
            guildId,
          },
          embeds: [],
          content: "content",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest
        .spyOn(
          feedConnectionsDiscordChannelsService,
          "createDiscordChannelConnection"
        )
        .mockResolvedValue(connection);

      const result = await controller.createDiscordChannelConnection(
        {
          _id: new Types.ObjectId(),
        } as never,
        {
          channelId,
          name,
        },
        {
          access_token: accessToken,
        } as never
      );

      expect(result).toEqual({
        id: connection.id.toHexString(),
        name: connection.name,
        key: FeedConnectionType.DiscordChannel,
        filters: {
          expression: {},
        },
        details: {
          channel: {
            id: connection.details.channel.id,
            guildId: connection.details.channel.guildId,
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
        .spyOn(feedConnectionsDiscordChannelsService, "sendTestArticle")
        .mockResolvedValue({
          status: TestDeliveryStatus.Success,
          apiPayload: {
            foo: "bar",
          },
          apiResponse: {
            baz: "qux",
          },
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
          apiPayload: {
            foo: "bar",
          },
          apiResponse: {
            baz: "qux",
          },
        },
      });
    });
  });

  describe("updateDiscordChannelConnection", () => {
    const name = "name";
    const feedId = new Types.ObjectId();
    const connectionId = new Types.ObjectId();
    const guildId = "guildId";
    const channelId = "channelId";
    const connection = {
      id: new Types.ObjectId(),
      name,
      filters: {
        expression: {},
      },
      details: {
        formatter: {
          formatTables: true,
          stripImages: true,
        },
        channel: {
          id: channelId,
          guildId,
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
          feedConnectionsDiscordChannelsService,
          "updateDiscordChannelConnection"
        )
        .mockResolvedValue(connection);
    });

    it("flattens the input embed before passing it to the service", async () => {
      await controller.updateDiscordChannelConnection(
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
          access_token: "accessToken",
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

      expect(updateSpy).toHaveBeenCalledWith(
        feedId.toHexString(),
        connectionId.toHexString(),
        {
          accessToken: "accessToken",
          updates: {
            name: undefined,
            filters: undefined,
            details: {
              content: undefined,
              embeds: [expectedEmbed],
              channel: undefined,
            },
          },
        }
      );
    });

    it("clears disabled code if content is updated", async () => {
      await controller.updateDiscordChannelConnection(
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
          access_token: "accessToken",
        } as never
      );

      expect(updateSpy).toHaveBeenCalledWith(
        feedId.toHexString(),
        connectionId.toHexString(),
        {
          accessToken: "accessToken",
          updates: {
            name: undefined,
            filters: undefined,
            disabledCode: null,
            details: {
              content: "hello world",
              embeds: undefined,
              channel: undefined,
            },
          },
        }
      );
    });

    it("sets channel id to current channel id if connection is currently disabled because of missing permissions", async () => {
      await controller.updateDiscordChannelConnection(
        {
          feed: {
            _id: feedId,
            guild: guildId,
          },
          connection: {
            id: connectionId,
            disabledCode: FeedConnectionDisabledCode.MissingPermissions,
            details: {
              channel: {
                id: channelId,
              },
            },
          },
        } as never,
        {
          disabledCode: null,
        },
        {
          access_token: "accessToken",
        } as never
      );

      expect(updateSpy).toHaveBeenCalledWith(
        feedId.toHexString(),
        connectionId.toHexString(),
        {
          accessToken: "accessToken",
          updates: {
            name: undefined,
            filters: undefined,
            disabledCode: null,
            details: {
              content: undefined,
              embeds: undefined,
              channel: {
                id: channelId,
              },
            },
          },
        }
      );
    });

    it("throws if attempting to enable feed for unhandled disabled code", async () => {
      await expect(
        controller.updateDiscordChannelConnection(
          {
            feed: {
              _id: feedId,
              guild: guildId,
            },
            connection: {
              id: connectionId,
              disabledCode: FeedConnectionDisabledCode.Unknown,
              details: {
                channel: {
                  id: channelId,
                },
              },
            },
          } as never,
          {
            disabledCode: null,
          },
          {
            access_token: "accessToken",
          } as never
        )
      ).rejects.toThrow(CannotEnableAutoDisabledConnection);
    });

    it("throws if attempting to enable when feed has a bad format", async () => {
      await expect(
        controller.updateDiscordChannelConnection(
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

    it("clears disabled code if embeds are updated", async () => {
      await controller.updateDiscordChannelConnection(
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
          access_token: "accessToken",
        } as never
      );

      expect(updateSpy).toHaveBeenCalledWith(
        feedId.toHexString(),
        connectionId.toHexString(),
        {
          accessToken: "accessToken",
          updates: {
            name: undefined,
            filters: undefined,
            disabledCode: null,
            details: {
              content: undefined,
              embeds: [],
              channel: undefined,
            },
          },
        }
      );
    });

    it("allows connection to be disabled when disable code is manual", async () => {
      await controller.updateDiscordChannelConnection(
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
          access_token: "accessToken",
        } as never
      );

      expect(updateSpy).toHaveBeenCalledWith(
        feedId.toHexString(),
        connectionId.toHexString(),
        {
          accessToken: "accessToken",
          updates: {
            name: undefined,
            filters: undefined,
            disabledCode: FeedConnectionDisabledCode.Manual,
            details: {
              content: undefined,
              embeds: undefined,
              channel: undefined,
            },
          },
        }
      );
    });
  });

  describe("deleteDiscordChannelConnection", () => {
    const feedId = new Types.ObjectId();
    const connectionId = new Types.ObjectId();
    const pipeOutput = {
      feed: {
        _id: feedId,
      },
      connection: {
        id: connectionId,
      },
    };

    it("calls the service to delete the connection", async () => {
      await controller.deleteDiscordChannelConnection(pipeOutput as never);

      expect(
        feedConnectionsDiscordChannelsService.deleteConnection
      ).toHaveBeenCalledWith(feedId.toHexString(), connectionId.toHexString());
    });

    it("returns undefined", async () => {
      const result = await controller.deleteDiscordChannelConnection(
        pipeOutput as never
      );

      expect(result).toBeUndefined();
    });
  });
});

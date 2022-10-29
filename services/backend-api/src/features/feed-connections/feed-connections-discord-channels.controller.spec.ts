import { Types } from "mongoose";
import { FeedConnectionType } from "../feeds/constants";
import { FeedConnectionsDiscordChannelsService } from "./feed-connections-discord-channels.service";
// eslint-disable-next-line max-len
import { FeedConnectionsDiscordChannelsController } from "./feed-connections-discord-channels.controller";

describe("FeedConnectionsDiscordChannelsController", () => {
  let feedConnectionsDiscordChannelsService: FeedConnectionsDiscordChannelsService;
  let controller: FeedConnectionsDiscordChannelsController;

  beforeEach(async () => {
    jest.resetAllMocks();
    feedConnectionsDiscordChannelsService = {
      createDiscordChannelConnection: jest.fn(),
      createDiscordWebhookConnection: jest.fn(),
    } as never;
    controller = new FeedConnectionsDiscordChannelsController(
      feedConnectionsDiscordChannelsService
    );
  });

  describe("createDiscordChannelConnection", () => {
    it("returns the discord channel connection", async () => {
      const channelId = "channelId";
      const name = "name";
      const accessToken = "accessToken";
      const connection = {
        id: new Types.ObjectId(),
        name,
        filters: {
          expression: {},
        },
        details: {
          type: FeedConnectionType.DiscordChannel,
          channel: {
            id: channelId,
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
          },
          embeds: connection.details.embeds,
          content: connection.details.content,
        },
      });
    });
  });
});

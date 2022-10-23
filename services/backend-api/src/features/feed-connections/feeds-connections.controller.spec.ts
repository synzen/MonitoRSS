import { Types } from "mongoose";
import { FeedConnectionType } from "../feeds/constants";
import { FeedConnectionsService } from "./feed-connections.service";
import { FeedsConnectionsController } from "./feeds-connections.controller";

describe("FeedConnectionsController", () => {
  let feedConnectionsService: FeedConnectionsService;
  let controller: FeedsConnectionsController;

  beforeEach(async () => {
    jest.resetAllMocks();
    feedConnectionsService = {
      createDiscordChannelConnection: jest.fn(),
    } as never;
    controller = new FeedsConnectionsController(feedConnectionsService);
  });

  it("returns the discord channel connection", async () => {
    const channelId = "channelId";
    const name = "name";
    const accessToken = "accessToken";
    const connection = {
      id: new Types.ObjectId(),
      name,
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
      .spyOn(feedConnectionsService, "createDiscordChannelConnection")
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
      details: {
        channel: {
          id: connection.details.channel.id,
        },
        embeds: connection.details.embeds,
        type: FeedConnectionType.DiscordChannel,
        content: connection.details.content,
      },
    });
  });
});

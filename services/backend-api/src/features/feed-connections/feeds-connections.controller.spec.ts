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
      createDiscordWebhookConnection: jest.fn(),
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
      .spyOn(feedConnectionsService, "createDiscordWebhookConnection")
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

import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { DiscordAPIError } from "../../common/errors/DiscordAPIError";
import { DiscordChannelNotOwnedException } from "../../common/exceptions";
import {
  setupIntegrationTests,
  teardownIntegrationTests,
} from "../../utils/integration-tests";
import { MongooseTestModule } from "../../utils/mongoose-test.module";
import { Feed, FeedFeature } from "../feeds/entities/feed.entity";
import { FeedsService } from "../feeds/feeds.service";
import {
  DiscordChannelPermissionsException,
  MissingDiscordChannelException,
} from "./exceptions";
import { FeedConnectionsDiscordChannelsService } from "./feed-connections-discord-channels.service";

describe("FeedConnectionsDiscordChannelsService", () => {
  let service: FeedConnectionsDiscordChannelsService;
  let feedModel: Model<Feed>;
  const feedsService = {
    canUseChannel: jest.fn(),
  };

  beforeAll(async () => {
    const { init } = await setupIntegrationTests({
      providers: [
        FeedConnectionsDiscordChannelsService,
        {
          provide: FeedsService,
          useValue: feedsService,
        },
      ],
      imports: [
        MongooseTestModule.forRoot(),
        MongooseModule.forFeature([FeedFeature]),
      ],
    });

    const { module } = await init();

    service = module.get(FeedConnectionsDiscordChannelsService);
    feedModel = module.get(getModelToken(Feed.name));
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterEach(async () => {
    await feedModel.deleteMany({});
  });

  afterAll(async () => {
    teardownIntegrationTests();
  });

  describe("createDiscordChannelConnection", () => {
    const guildId = "guild-id";

    it("saves the new connection", async () => {
      const createdFeed = await feedModel.create({
        title: "my feed",
        channel: "688445354513137784",
        guild: guildId,
        isFeedv2: true,
        url: "url",
      });

      feedsService.canUseChannel.mockResolvedValue({
        guild_id: guildId,
      });

      const creationDetails = {
        feedId: createdFeed._id.toHexString(),
        channelId: createdFeed.channel,
        name: "name",
        userAccessToken: "user-access-token",
        guildId: guildId,
      };
      await service.createDiscordChannelConnection(creationDetails);

      const updatedFeed = await feedModel.findById(createdFeed._id).lean();

      expect(updatedFeed?.connections.discordChannels).toHaveLength(1);
      expect(updatedFeed?.connections.discordChannels[0]).toMatchObject({
        id: expect.any(Types.ObjectId),
        name: creationDetails.name,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        details: {
          embeds: [],
          channel: {
            id: creationDetails.channelId,
          },
        },
      });
    });
  });

  describe("updateDiscordChannelConnection", () => {
    const guildId = "guild-id";
    const connectionIdToUse = new Types.ObjectId();
    let createdFeed: Feed;
    const updateInput = {
      accessToken: "access-token",
      guildId,
      updates: {
        name: "updatedName",
        filters: {
          expression: {
            foo: "bar",
          },
        },
        details: {
          channel: {
            id: "updatedChannelId",
          },
          content: "updatedContent",
          embeds: [
            {
              title: "updatedTitle",
              description: "updatedDescription",
              url: "updatedUrl",
              color: "123",
            },
          ],
        },
      },
    };

    beforeEach(async () => {
      createdFeed = await feedModel.create({
        title: "my feed",
        channel: "688445354513137784",
        guild: guildId,
        isFeedv2: true,
        url: "url",
        connections: {
          discordChannels: [
            {
              id: connectionIdToUse,
              name: "name",
              details: {
                channel: {
                  id: "channel-id",
                },
                embeds: [],
              },
            },
          ],
        },
      });

      feedsService.canUseChannel.mockResolvedValue({
        guild_id: guildId,
      });
    });

    it("updates the connection", async () => {
      await service.updateDiscordChannelConnection(
        createdFeed._id.toHexString(),
        connectionIdToUse.toHexString(),
        updateInput
      );

      const updatedFeed = await feedModel.findById(createdFeed._id).lean();

      expect(updatedFeed?.connections.discordChannels).toHaveLength(1);
      expect(updatedFeed?.connections.discordChannels[0]).toMatchObject({
        id: connectionIdToUse,
        name: updateInput.updates.name,
        filters: updateInput.updates.filters,
        details: {
          embeds: updateInput.updates.details?.embeds,
          channel: {
            id: updateInput.updates.details.channel.id,
          },
          content: updateInput.updates.details?.content,
        },
      });
    });

    it("throws if channel does not exist", async () => {
      feedsService.canUseChannel.mockRejectedValue(
        new DiscordAPIError("", 404)
      );

      await expect(
        service.updateDiscordChannelConnection(
          createdFeed._id.toHexString(),
          connectionIdToUse.toHexString(),
          updateInput
        )
      ).rejects.toThrow(MissingDiscordChannelException);
    });

    it("throws if bot does not have access to channel", async () => {
      feedsService.canUseChannel.mockRejectedValue(
        new DiscordAPIError("", 403)
      );

      await expect(
        service.updateDiscordChannelConnection(
          createdFeed._id.toHexString(),
          connectionIdToUse.toHexString(),
          updateInput
        )
      ).rejects.toThrow(DiscordChannelPermissionsException);
    });

    it("throws if channel guild does not match input guild", async () => {
      feedsService.canUseChannel.mockResolvedValue({
        guild_id: guildId + "-other",
      });

      await expect(
        service.updateDiscordChannelConnection(
          createdFeed._id.toHexString(),
          connectionIdToUse.toHexString(),
          updateInput
        )
      ).rejects.toThrow(DiscordChannelNotOwnedException);
    });
  });

  describe("deleteConnection", () => {
    it("removes the discord channel connection by id", async () => {
      const guildId = "guild-id";
      const connectionIdToUse = new Types.ObjectId();
      const createdFeed = await feedModel.create({
        title: "my feed",
        channel: "688445354513137784",
        guild: guildId,
        isFeedv2: true,
        url: "url",
        connections: {
          discordChannels: [
            {
              id: connectionIdToUse,
              name: "name",
              details: {
                channel: {
                  id: "channel-id",
                },
                embeds: [],
              },
            },
          ],
        },
      });

      await service.deleteConnection(
        createdFeed._id.toHexString(),
        connectionIdToUse.toHexString()
      );

      const updatedFeed = await feedModel.findById(createdFeed._id).lean();

      expect(updatedFeed?.connections.discordChannels).toHaveLength(0);
    });
  });
});

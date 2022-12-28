import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { DiscordAPIError } from "../../common/errors/DiscordAPIError";
import { InvalidFilterExpressionException } from "../../common/exceptions";
import { TestDeliveryStatus } from "../../services/feed-handler/constants";
import { FeedHandlerService } from "../../services/feed-handler/feed-handler.service";
import {
  setupIntegrationTests,
  teardownIntegrationTests,
} from "../../utils/integration-tests";
import { MongooseTestModule } from "../../utils/mongoose-test.module";
import { FeedConnectionDisabledCode } from "../feeds/constants";
import { DiscordChannelConnection } from "../feeds/entities/feed-connections";
import { FeedsService } from "../feeds/feeds.service";
import { UserFeed, UserFeedFeature } from "../user-feeds/entities";
import {
  DiscordChannelPermissionsException,
  MissingDiscordChannelException,
} from "./exceptions";
import { FeedConnectionsDiscordChannelsService } from "./feed-connections-discord-channels.service";

describe("FeedConnectionsDiscordChannelsService", () => {
  let service: FeedConnectionsDiscordChannelsService;
  let userFeedsModel: Model<UserFeed>;
  const feedsService = {
    canUseChannel: jest.fn(),
  };
  const feedHandlerService = {
    sendTestArticle: jest.fn(),
    validateFilters: jest.fn(),
  };

  beforeAll(async () => {
    const { init } = await setupIntegrationTests({
      providers: [
        FeedConnectionsDiscordChannelsService,
        {
          provide: FeedsService,
          useValue: feedsService,
        },
        {
          provide: FeedHandlerService,
          useValue: feedHandlerService,
        },
      ],
      imports: [
        MongooseTestModule.forRoot(),
        MongooseModule.forFeature([UserFeedFeature]),
      ],
    });

    const { module } = await init();

    service = module.get(FeedConnectionsDiscordChannelsService);
    userFeedsModel = module.get(getModelToken(UserFeed.name));
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterEach(async () => {
    await userFeedsModel.deleteMany({});
  });

  afterAll(async () => {
    teardownIntegrationTests();
  });

  describe("createDiscordChannelConnection", () => {
    const guildId = "guild-id";
    const channelId = "channel-id";

    it("saves the new connection", async () => {
      const createdFeed = await userFeedsModel.create({
        title: "my feed",
        url: "url",
        user: {
          discordUserId: "user-id",
        },
      });

      feedsService.canUseChannel.mockResolvedValue({
        guild_id: guildId,
      });

      const creationDetails = {
        feedId: createdFeed._id.toHexString(),
        channelId,
        name: "name",
        userAccessToken: "user-access-token",
        guildId: guildId,
      };
      await service.createDiscordChannelConnection(creationDetails);

      const updatedFeed = await userFeedsModel.findById(createdFeed._id).lean();

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
            guildId,
          },
        },
      });
    });
  });

  describe("updateDiscordChannelConnection", () => {
    const guildId = "guild-id";
    const connectionIdToUse = new Types.ObjectId();
    let createdFeed: UserFeed;
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
      createdFeed = await userFeedsModel.create({
        title: "my feed",
        url: "url",
        user: {
          discordUserId: "user-id",
        },
        connections: {
          discordChannels: [
            {
              id: connectionIdToUse,
              name: "name",
              disabledCode: FeedConnectionDisabledCode.BadFormat,
              filters: {
                expression: {
                  foo: "bar",
                },
              },
              details: {
                channel: {
                  id: "channel-id",
                  guildId,
                },
                embeds: [
                  {
                    author: {
                      name: "hi",
                    },
                  },
                ],
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

      const updatedFeed = await userFeedsModel.findById(createdFeed._id).lean();

      expect(updatedFeed?.connections.discordChannels).toHaveLength(1);
      expect(updatedFeed?.connections.discordChannels[0]).toMatchObject({
        id: connectionIdToUse,
        name: updateInput.updates.name,
        filters: updateInput.updates.filters,
        details: {
          embeds: updateInput.updates.details?.embeds,
          channel: {
            id: updateInput.updates.details.channel.id,
            guildId,
          },
          content: updateInput.updates.details?.content,
        },
      });
    });

    it("allows nullable properties to be cleared", async () => {
      await service.updateDiscordChannelConnection(
        createdFeed._id.toHexString(),
        connectionIdToUse.toHexString(),
        {
          accessToken: updateInput.accessToken,
          updates: {
            filters: null,
            disabledCode: null,
          },
        }
      );

      const updatedFeed = await userFeedsModel.findById(createdFeed._id).lean();

      expect(updatedFeed?.connections.discordChannels).toHaveLength(1);
      expect(updatedFeed?.connections.discordChannels[0]).not.toHaveProperty(
        "filters"
      );
      expect(updatedFeed?.connections.discordChannels[0]).not.toHaveProperty(
        "disabledCode"
      );
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

    it("throws on invalid filters", async () => {
      feedHandlerService.validateFilters.mockResolvedValue({
        errors: ["1", "2"],
      });

      await expect(
        service.updateDiscordChannelConnection(
          createdFeed._id.toHexString(),
          connectionIdToUse.toHexString(),
          {
            accessToken: updateInput.accessToken,
            updates: {
              filters: {
                expression: {
                  foo: "bar",
                  baz: "qux",
                },
              },
            },
          }
        )
      ).rejects.toThrow(InvalidFilterExpressionException);
    });
  });

  describe("deleteConnection", () => {
    it("removes the discord channel connection by id", async () => {
      const connectionIdToUse = new Types.ObjectId();
      const createdFeed = await userFeedsModel.create({
        title: "my feed",
        url: "url",
        user: {
          discordUserId: "user-id",
        },
        connections: {
          discordChannels: [
            {
              id: connectionIdToUse,
              name: "name",
              details: {
                channel: {
                  id: "channel-id",
                  guildId: "guild-id",
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

      const updatedFeed = await userFeedsModel.findById(createdFeed._id).lean();

      expect(updatedFeed?.connections.discordChannels).toHaveLength(0);
    });
  });

  describe("sendTestArticle", () => {
    const userFeed: UserFeed = Object.freeze({
      title: "my feed",
      url: "url",
      user: {
        discordUserId: "user-id",
      },
      connections: {
        discordChannels: [
          {
            id: new Types.ObjectId(),
            name: "name",
            details: {
              channel: {
                id: "channel-id",
                guildId: "guild-id",
              },
              embeds: [],
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        discordWebhooks: [],
      },
    }) as never;
    const targetConnection: DiscordChannelConnection = Object.freeze(
      userFeed.connections.discordChannels[0]
    );

    it("calls sendTestArticle with the correct args", async () => {
      const sendTestArticle = jest.spyOn(feedHandlerService, "sendTestArticle");

      await service.sendTestArticle(userFeed, targetConnection);

      expect(sendTestArticle).toHaveBeenCalledWith({
        details: {
          type: "discord",
          feed: {
            url: userFeed.url,
          },
          mediumDetails: {
            channel: {
              id: targetConnection.details.channel.id,
            },
            content: targetConnection.details.content,
            embeds: targetConnection.details.embeds,
          },
        },
      });
    });

    it("returns the result", async () => {
      const testResult = {
        status: TestDeliveryStatus.Success,
      };
      jest
        .spyOn(feedHandlerService, "sendTestArticle")
        .mockResolvedValue(testResult);

      const result = await service.sendTestArticle(userFeed, targetConnection);

      expect(result).toEqual(testResult);
    });
  });
});

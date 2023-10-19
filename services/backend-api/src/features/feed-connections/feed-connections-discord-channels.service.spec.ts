/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import { randomUUID } from "crypto";
import { Model, Types } from "mongoose";
import { DiscordAPIError } from "../../common/errors/DiscordAPIError";
import { InvalidFilterExpressionException } from "../../common/exceptions";
import { DiscordAPIService } from "../../services/apis/discord/discord-api.service";
import { TestDeliveryStatus } from "../../services/feed-handler/constants";
import { FeedHandlerService } from "../../services/feed-handler/feed-handler.service";
import {
  setupIntegrationTests,
  teardownIntegrationTests,
} from "../../utils/integration-tests";
import { MongooseTestModule } from "../../utils/mongoose-test.module";
import { DiscordAuthService } from "../discord-auth/discord-auth.service";
import { DiscordWebhooksService } from "../discord-webhooks/discord-webhooks.service";
import {
  FeedConnectionDisabledCode,
  FeedConnectionDiscordComponentButtonStyle,
  FeedConnectionDiscordComponentType,
} from "../feeds/constants";
import { DiscordChannelConnection } from "../feeds/entities/feed-connections";
import { FeedsService } from "../feeds/feeds.service";
import { SupportersService } from "../supporters/supporters.service";
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
  const supportersService = {
    getBenefitsOfDiscordUser: jest.fn(),
  };
  const discordWebhooksService = {
    getWebhook: jest.fn(),
    canBeUsedByBot: jest.fn(),
  };
  const discordApiService = {
    getChannel: jest.fn(),
  };
  const discordAuthService = {
    userManagesGuild: jest.fn(),
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
        {
          provide: SupportersService,
          useValue: supportersService,
        },
        {
          provide: DiscordWebhooksService,
          useValue: discordWebhooksService,
        },
        {
          provide: DiscordAPIService,
          useValue: discordApiService,
        },
        {
          provide: DiscordAuthService,
          useValue: discordAuthService,
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
    feedHandlerService.validateFilters.mockResolvedValue({
      errors: [],
    });
    supportersService.getBenefitsOfDiscordUser.mockResolvedValue({
      allowCustomPlaceholders: true,
    });
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
        discordUserId: "user-id",
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
          formatter: {
            formatTables: false,
            stripImages: false,
          },
        },
      });
    });
  });

  describe("cloneConnection", () => {
    it("clones the connection and returns the new id", async () => {
      const guildId = "guild-id";
      const connectionIdToUse = new Types.ObjectId();
      const connection: DiscordChannelConnection = {
        id: connectionIdToUse,
        name: "name",
        createdAt: new Date(),
        updatedAt: new Date(),
        disabledCode: FeedConnectionDisabledCode.BadFormat,
        filters: {
          expression: {
            foo: "bar",
          },
        },
        splitOptions: {
          splitChar: "1",
          appendChar: "2",
          prependChar: "3",
        },
        details: {
          channel: {
            id: "channel-id",
            guildId,
          },
          embeds: [],
          content: "content",
          formatter: {
            formatTables: true,
            stripImages: true,
          },
        },
      };

      const createdFeed = await userFeedsModel.create({
        title: "my feed",
        url: "url",
        user: {
          discordUserId: "user-id",
        },
        connections: {
          discordChannels: [connection],
        },
      });

      const { id: clonedConnectionId } = await service.cloneConnection(
        createdFeed,
        connection,
        {
          name: connection.name + "new-name",
        },
        "token"
      );

      const updatedFeed = await userFeedsModel.findById(createdFeed._id).lean();

      expect(updatedFeed?.connections.discordChannels).toHaveLength(2);

      const clonedConnection = updatedFeed?.connections.discordChannels.find(
        (c) => c.id.toHexString() === clonedConnectionId.toHexString()
      );

      expect(clonedConnection).toMatchObject({
        ...connection,
        name: connection.name + "new-name",
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });

  describe("updateDiscordChannelConnection", () => {
    const guildId = "guild-id";
    const connectionIdToUse = new Types.ObjectId();
    let createdFeed: UserFeed;
    const updateInput = {
      accessToken: "access-token",
      feed: {
        user: {
          discordUserId: "user-id",
        },
      },
      guildId,
      updates: {
        name: "updatedName",
        filters: {
          expression: {
            foo: "bar",
          },
        },
        customPlaceholders: [
          {
            id: randomUUID(),
            referenceName: "refe",
            sourcePlaceholder: "title",
            steps: [
              {
                id: randomUUID(),
                regexSearch: "regex-search",
                replacementString: "replacement",
              },
            ],
          },
        ],
        splitOptions: {
          splitChar: "s",
          appendChar: "a",
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
          componentRows: [
            {
              id: "row1",
              components: [
                {
                  id: "comp1",
                  type: FeedConnectionDiscordComponentType.Button,
                  label: "label",
                  url: "url",
                  style: FeedConnectionDiscordComponentButtonStyle.Link,
                },
              ],
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
              splitOptions: {
                splitChar: "1",
                appendChar: "2",
                prependChar: "3",
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
        customPlaceholders: [
          {
            id: updateInput.updates.customPlaceholders[0].id,
            referenceName: "refe",
            sourcePlaceholder: "title",
            steps: [
              {
                id: updateInput.updates.customPlaceholders[0].steps[0].id,
                regexSearch: "regex-search",
                replacementString: "replacement",
              },
            ],
          },
        ],
        details: {
          embeds: updateInput.updates.details?.embeds,
          channel: {
            id: updateInput.updates.details.channel.id,
            guildId,
          },
          content: updateInput.updates.details?.content,
          componentRows: updateInput.updates.details?.componentRows,
        },
      });
    });

    it("updates disabled code", async () => {
      await service.updateDiscordChannelConnection(
        createdFeed._id.toHexString(),
        connectionIdToUse.toHexString(),
        {
          accessToken: updateInput.accessToken,
          feed: createdFeed,
          updates: {
            disabledCode: FeedConnectionDisabledCode.BadFormat,
          },
        }
      );

      const updatedFeed = await userFeedsModel.findById(createdFeed._id).lean();

      expect(updatedFeed?.connections.discordChannels).toHaveLength(1);
      expect(updatedFeed?.connections.discordChannels[0]).toMatchObject({
        id: connectionIdToUse,
        disabledCode: FeedConnectionDisabledCode.BadFormat,
      });
    });

    it("updates split options", async () => {
      await service.updateDiscordChannelConnection(
        createdFeed._id.toHexString(),
        connectionIdToUse.toHexString(),
        {
          accessToken: updateInput.accessToken,
          feed: createdFeed,
          updates: {
            splitOptions: updateInput.updates.splitOptions,
          },
        }
      );

      const updatedFeed = await userFeedsModel.findById(createdFeed._id).lean();

      expect(updatedFeed?.connections.discordChannels).toHaveLength(1);
      expect(updatedFeed?.connections.discordChannels[0]).toMatchObject({
        id: connectionIdToUse,
        splitOptions: updateInput.updates.splitOptions,
      });
    });

    it("allows nullable properties to be cleared", async () => {
      await service.updateDiscordChannelConnection(
        createdFeed._id.toHexString(),
        connectionIdToUse.toHexString(),
        {
          accessToken: updateInput.accessToken,
          feed: createdFeed,
          updates: {
            filters: null,
            disabledCode: null,
            splitOptions: null,
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
      expect(updatedFeed?.connections.discordChannels[0]).not.toHaveProperty(
        "splitOptions"
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
            feed: createdFeed,
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
          article: undefined,
          type: "discord",
          feed: {
            url: userFeed.url,
            formatOptions: {
              dateFormat: undefined,
            },
          },
          mediumDetails: {
            channel: {
              id: targetConnection.details.channel!.id,
              type: undefined,
            },
            content: expect.any(String),
            embeds: targetConnection.details.embeds,
            formatter: undefined,
            forumThreadTags: undefined,
            forumThreadTitle: undefined,
            splitOptions: undefined,
          },
        },
      });
    });

    it("calls sendTestArticle with the specific article if the field exists", async () => {
      const sendTestArticle = jest.spyOn(feedHandlerService, "sendTestArticle");

      await service.sendTestArticle(userFeed, targetConnection, {
        article: {
          id: "1",
        },
      });

      expect(sendTestArticle).toHaveBeenCalledWith({
        details: {
          type: "discord",
          feed: {
            url: userFeed.url,
            formatOptions: {
              dateFormat: undefined,
            },
          },
          article: {
            id: "1",
          },
          mediumDetails: {
            channel: {
              id: targetConnection.details.channel!.id,
              type: undefined,
            },
            content: expect.any(String),
            embeds: targetConnection.details.embeds,
            formatter: undefined,
            forumThreadTags: undefined,
            forumThreadTitle: undefined,
            splitOptions: undefined,
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

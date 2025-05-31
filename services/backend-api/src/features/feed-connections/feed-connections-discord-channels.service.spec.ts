/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import { randomUUID } from "crypto";
import { AnyKeys, Model, Types } from "mongoose";
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
  FeedConnectionMentionType,
} from "../feeds/constants";
import { DiscordChannelConnection } from "../feeds/entities/feed-connections";
import { FeedsService } from "../feeds/feeds.service";
import { SupportersService } from "../supporters/supporters.service";
import { UserFeed, UserFeedFeature } from "../user-feeds/entities";
import { CopyableSetting } from "./dto";
import {
  DiscordChannelPermissionsException,
  MissingDiscordChannelException,
} from "./exceptions";
import {
  FeedConnectionsDiscordChannelsService,
  UpdateDiscordChannelConnectionInput,
} from "./feed-connections-discord-channels.service";
import { CustomPlaceholderStepType } from "../../common/constants/custom-placeholder-step-type.constants";
import { UserFeedConnectionEventsService } from "../user-feed-connection-events/user-feed-connection-events.service";
import { UsersService } from "../users/users.service";

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
  const userFeedConnectionEventsService = {
    handleCreatedEvents: jest.fn(),
  };
  const usersService = {
    getOrCreateUserByDiscordId: jest.fn(),
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
        {
          provide: UserFeedConnectionEventsService,
          useValue: userFeedConnectionEventsService,
        },
        {
          provide: UsersService,
          useValue: usersService,
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
        feed: createdFeed,
        name: "name",
        channelId,
        userAccessToken: "user-access-token",
        guildId: guildId,
        userDiscordUserId: "user-id",
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

      const { ids } = await service.cloneConnection(
        connection,
        {
          name: connection.name + "new-name",
          targetFeedIds: [createdFeed._id.toHexString()],
        },
        "token",
        "user-id"
      );

      const clonedConnectionId = ids[0];

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
    let oldConnection: DiscordChannelConnection;
    let createdFeed: UserFeed;
    let updateInput: UpdateDiscordChannelConnectionInput;

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

      oldConnection = createdFeed.connections.discordChannels[0];

      updateInput = {
        accessToken: "access-token",
        oldConnection,
        feed: {
          user: {
            discordUserId: "user-id",
          },
          connections: createdFeed.connections,
        },
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
                  type: CustomPlaceholderStepType.Regex,
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
            channelNewThreadExcludesPreview: false,
            channelNewThreadTitle: "",
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
            id: updateInput.updates.customPlaceholders?.[0].id,
            referenceName: "refe",
            sourcePlaceholder: "title",
            steps: [
              {
                id: updateInput.updates.customPlaceholders?.[0]?.steps?.[0].id,
                regexSearch: "regex-search",
                replacementString: "replacement",
              },
            ],
          },
        ],
        details: {
          embeds: updateInput.updates.details?.embeds,
          channel: {
            id: updateInput.updates.details?.channel?.id,
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
          oldConnection,
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
          oldConnection,
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
          oldConnection,
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
            oldConnection,
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

  describe("copySettings", () => {
    const guildId = "guild-id";
    let sourceConnection: DiscordChannelConnection;
    let createdFeed: UserFeed;
    const targetConnectionIds = [
      new Types.ObjectId().toHexString(),
      new Types.ObjectId().toHexString(),
    ];
    const userFeedDataToInsert: AnyKeys<UserFeed> = {
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
            disabledCode: FeedConnectionDisabledCode.BadFormat,
            filters: {
              expression: {
                foo: "bar",
              },
            },
            rateLimits: [
              {
                id: "1",
                timeWindowSeconds: 100,
                limit: 10,
              },
            ],
            splitOptions: {
              splitChar: "1",
              appendChar: "2",
              prependChar: "3",
            },
            mentions: {
              targets: [
                {
                  id: "1",
                  type: FeedConnectionMentionType.Role,
                  filters: {
                    expression: {
                      foo: "bar",
                    },
                  },
                },
              ],
            },
            details: {
              webhook: {
                id: "webhook-id-1",
                channel: "channel-id",
                guildId: "guild-id",
                token: "token",
                iconUrl: "icon-url",
                name: "name",
                isApplicationOwned: true,
                threadId: "thread-id",
              },
              embeds: [
                {
                  authorName: "auth name",
                  authorURL: "auth url",
                  fields: [],
                },
              ],
              formatter: {
                disableImageLinkPreviews: true,
                formatTables: true,
                stripImages: true,
              },
              componentRows: [
                {
                  id: "1",
                  components: [
                    {
                      id: "1",
                      label: "label",
                      style: 5,
                      type: FeedConnectionDiscordComponentType.Button,
                      url: "url",
                    },
                  ],
                },
              ],
              content: "content",
              enablePlaceholderFallback: true,
              forumThreadTags: [
                {
                  id: "1",
                  filters: {
                    expression: {
                      hello: "world",
                    },
                  },
                },
              ],
              forumThreadTitle: "forum-thread-title",
              placeholderLimits: [
                {
                  characterCount: 100,
                  placeholder: "placeholder",
                  appendString: "append-string",
                },
              ],
            },
          },
          {
            id: targetConnectionIds[0],
            name: "name",
            details: {
              channel: {
                id: "channel-id2",
                guildId,
              },
              embeds: [],
              webhook: {
                id: "webhook-id-2",
                channel: "channel-id",
                guildId: "guild-id",
                token: "token",
                iconUrl: "icon-url2",
                name: "name2",
                isApplicationOwned: true,
              },
            },
          },
          {
            id: targetConnectionIds[1],
            name: "name",
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
                id: "channel-id3",
                guildId,
              },
              embeds: [],
              webhook: {
                id: "webhook-id-3",
                channel: "channel-id",
                guildId: "guild-id",
                token: "token",
                iconUrl: "icon-url3",
                name: "name3",
                isApplicationOwned: true,
              },
            },
          },
        ],
      },
    };

    beforeEach(async () => {
      createdFeed = await userFeedsModel.create(userFeedDataToInsert);
      sourceConnection = userFeedDataToInsert.connections.discordChannels[0];
    });

    it("copies settings correctly", async () => {
      await service.copySettings(createdFeed, sourceConnection, {
        properties: Object.values(CopyableSetting) as CopyableSetting[],
        targetDiscordChannelConnectionIds: targetConnectionIds,
      });

      // Assert all relevant fields of source connection were copied to the other two connections
      const updatedFeed = await userFeedsModel.findById(createdFeed._id).lean();

      expect(updatedFeed?.connections.discordChannels).toHaveLength(3);

      const targetConnections = updatedFeed?.connections.discordChannels.filter(
        (c) => targetConnectionIds.includes(c.id.toHexString())
      );

      expect(targetConnections).toHaveLength(2);

      targetConnections?.forEach((c) => {
        expect(c).toMatchObject({
          filters: sourceConnection.filters,
          splitOptions: sourceConnection.splitOptions,
          rateLimits: sourceConnection.rateLimits,
          mentions: sourceConnection.mentions,
          details: {
            embeds: sourceConnection.details.embeds,
            formatter: sourceConnection.details.formatter,
            content: sourceConnection.details.content,
            componentRows: sourceConnection.details.componentRows,
            enablePlaceholderFallback:
              sourceConnection.details.enablePlaceholderFallback,
            forumThreadTags: sourceConnection.details.forumThreadTags,
            forumThreadTitle: sourceConnection.details.forumThreadTitle,
            placeholderLimits: sourceConnection.details.placeholderLimits,
            webhook: {
              iconUrl: sourceConnection.details.webhook?.iconUrl,
              name: sourceConnection.details.webhook?.name,
              threadId: sourceConnection.details.webhook?.threadId,
            },
          },
        });
      });
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

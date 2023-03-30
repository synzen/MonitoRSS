import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  DiscordWebhookInvalidTypeException,
  DiscordWebhookMissingUserPermException,
  DiscordWebhookNonexistentException,
  InvalidFilterExpressionException,
} from "../../common/exceptions";
import { TestDeliveryStatus } from "../../services/feed-handler/constants";
import { FeedHandlerService } from "../../services/feed-handler/feed-handler.service";
import {
  setupIntegrationTests,
  teardownIntegrationTests,
} from "../../utils/integration-tests";
import { MongooseTestModule } from "../../utils/mongoose-test.module";
import { DiscordAuthService } from "../discord-auth/discord-auth.service";
import { DiscordWebhooksService } from "../discord-webhooks/discord-webhooks.service";
import { FeedConnectionDisabledCode } from "../feeds/constants";
import { DiscordWebhookConnection } from "../feeds/entities/feed-connections";
import { UserFeed, UserFeedFeature } from "../user-feeds/entities";
import { FeedConnectionsDiscordWebhooksService } from "./feed-connections-discord-webhooks.service";

describe("FeedConnectionsDiscordWebhooksService", () => {
  let service: FeedConnectionsDiscordWebhooksService;
  let userFeedModel: Model<UserFeed>;
  const discordWebhooksService = {
    getWebhook: jest.fn(),
    canBeUsedByBot: jest.fn(),
  };
  const discordAuthService = {
    userManagesGuild: jest.fn(),
  };
  const feedHandlerService = {
    sendTestArticle: jest.fn(),
    validateFilters: jest.fn(),
  };

  beforeAll(async () => {
    const { init } = await setupIntegrationTests({
      providers: [
        FeedConnectionsDiscordWebhooksService,
        {
          provide: DiscordWebhooksService,
          useValue: discordWebhooksService,
        },
        {
          provide: DiscordAuthService,
          useValue: discordAuthService,
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

    service = module.get(FeedConnectionsDiscordWebhooksService);
    userFeedModel = module.get(getModelToken(UserFeed.name));
  });

  beforeEach(() => {
    jest.resetAllMocks();
    feedHandlerService.validateFilters.mockResolvedValue({
      errors: [],
    });
  });

  afterEach(async () => {
    await userFeedModel.deleteMany({});
  });

  afterAll(async () => {
    teardownIntegrationTests();
  });

  describe("createDiscordWebhookConnection", () => {
    let createdFeed: UserFeed;
    const guildId = "guild-id";
    let creationDetails: {
      accessToken: string;
      feedId: string;
      guildId: string;
      name: string;
      webhook: {
        id: string;
        iconUrl: string;
        name: string;
      };
    };

    beforeEach(async () => {
      createdFeed = await userFeedModel.create({
        title: "my feed",
        url: "url",
        user: {
          discordUserId: "discord-user-id",
        },
      });

      creationDetails = {
        accessToken: "access-token",
        feedId: createdFeed._id.toHexString(),
        guildId,
        name: "name",
        webhook: {
          id: "webhook-id",
          iconUrl: "icon-url",
          name: "webhook-name",
        },
      };
    });

    it("saves the new connection", async () => {
      discordWebhooksService.getWebhook.mockResolvedValue({
        token: "token",
        guild_id: creationDetails.guildId,
      });
      discordWebhooksService.canBeUsedByBot.mockReturnValue(true);
      discordAuthService.userManagesGuild.mockResolvedValue(true);

      await service.createDiscordWebhookConnection(creationDetails);

      const updatedFeed = await userFeedModel.findById(createdFeed._id).lean();

      expect(updatedFeed?.connections.discordWebhooks).toHaveLength(1);
      expect(updatedFeed?.connections.discordWebhooks[0]).toMatchObject({
        id: expect.any(Types.ObjectId),
        name: creationDetails.name,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        details: {
          embeds: [],
          webhook: {
            id: creationDetails.webhook.id,
            token: "token",
            name: creationDetails.webhook.name,
            iconUrl: creationDetails.webhook.iconUrl,
            guildId,
          },
        },
      });
    });

    it("throws an error if the webhook is not found", async () => {
      discordWebhooksService.getWebhook.mockResolvedValue(null);

      await expect(
        service.createDiscordWebhookConnection(creationDetails)
      ).rejects.toThrowError(DiscordWebhookNonexistentException);
    });

    it("throws an error if the webhook cannot be used by the bot", async () => {
      discordWebhooksService.getWebhook.mockResolvedValue({
        token: "token",
      });
      discordWebhooksService.canBeUsedByBot.mockReturnValue(false);

      await expect(
        service.createDiscordWebhookConnection(creationDetails)
      ).rejects.toThrowError(DiscordWebhookInvalidTypeException);
    });

    it("throws an error if webhook guild does not exist", async () => {
      discordWebhooksService.getWebhook.mockResolvedValue({
        token: "token",
      });
      discordWebhooksService.canBeUsedByBot.mockReturnValue(true);

      await expect(
        service.createDiscordWebhookConnection(creationDetails)
      ).rejects.toThrowError(DiscordWebhookMissingUserPermException);
    });

    it("throws an error if the user does not manage the guild", async () => {
      discordWebhooksService.getWebhook.mockResolvedValue({
        token: "token",
        guild_id: creationDetails.guildId,
      });
      discordWebhooksService.canBeUsedByBot.mockReturnValue(true);
      discordAuthService.userManagesGuild.mockResolvedValue(false);

      await expect(
        service.createDiscordWebhookConnection(creationDetails)
      ).rejects.toThrowError(DiscordWebhookMissingUserPermException);
    });
  });

  describe("updateDiscordWebhookConnection", () => {
    const connectionIdToUse = new Types.ObjectId().toHexString();
    let createdFeed: UserFeed;
    const guildId = "guild-id";
    const updateDetails = {
      filters: {
        expression: {
          foo: "new-filters",
        },
      },
      name: "new-name",
      splitOptions: {
        prependChar: "p",
        appendChar: "a",
      },
      details: {
        embeds: [
          {
            title: "new-embed-title",
          },
        ],
        webhook: {
          id: "new-webhook-id",
          iconUrl: "new-icon-url",
          name: "new-webhook-name",
          token: "new-token",
        },
        content: "new-content",
      },
    };
    const accessToken = "access-token";

    beforeEach(async () => {
      createdFeed = await userFeedModel.create({
        title: "my feed",
        url: "url",
        user: {
          discordUserId: "discord-user-id",
        },
        connections: {
          discordWebhooks: [
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
                prependChar: "1",
                appendChar: "2",
                splitChar: "3",
              },
              createdAt: new Date(),
              updatedAt: new Date(),
              details: {
                embeds: [],
                webhook: {
                  id: "old-webhook-id",
                  token: "old-token",
                  name: "old-webhook-name",
                  iconUrl: "old-icon-url",
                  guildId,
                },
                content: "old-content",
              },
            },
          ],
        },
      });
    });

    it("updates new connection", async () => {
      discordWebhooksService.getWebhook.mockResolvedValue({
        token: "token",
        guild_id: guildId,
      });
      discordWebhooksService.canBeUsedByBot.mockReturnValue(true);
      discordAuthService.userManagesGuild.mockResolvedValue(true);

      await service.updateDiscordWebhookConnection({
        feedId: createdFeed._id.toHexString(),
        connectionId: connectionIdToUse,
        updates: updateDetails,
        accessToken,
      });

      const updatedFeed = await userFeedModel.findById(createdFeed._id).lean();

      expect(updatedFeed?.connections.discordWebhooks).toHaveLength(1);
      expect(updatedFeed?.connections.discordWebhooks[0]).toMatchObject({
        id: new Types.ObjectId(connectionIdToUse),
        name: updateDetails.name,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        filters: updateDetails.filters,
        splitOptions: updateDetails.splitOptions,
        details: {
          embeds: updateDetails.details.embeds,
          webhook: {
            id: updateDetails.details.webhook.id,
            token: "token",
            name: updateDetails.details.webhook.name,
            iconUrl: updateDetails.details.webhook.iconUrl,
            guildId,
          },
          content: updateDetails.details.content,
        },
      });
    });

    it("allows properties to be cleared with null", async () => {
      discordWebhooksService.getWebhook.mockResolvedValue({
        token: "token",
        guild_id: guildId,
      });
      discordWebhooksService.canBeUsedByBot.mockReturnValue(true);
      discordAuthService.userManagesGuild.mockResolvedValue(true);

      await service.updateDiscordWebhookConnection({
        feedId: createdFeed._id.toHexString(),
        connectionId: connectionIdToUse,
        updates: {
          filters: null,
          disabledCode: null,
          splitOptions: null,
        },
        accessToken,
      });

      const updatedFeed = await userFeedModel.findById(createdFeed._id).lean();

      expect(updatedFeed?.connections.discordWebhooks).toHaveLength(1);
      expect(updatedFeed?.connections.discordWebhooks[0]).not.toHaveProperty(
        "filters"
      );
      expect(updatedFeed?.connections.discordWebhooks[0]).not.toHaveProperty(
        "disabledCode"
      );
      expect(updatedFeed?.connections.discordWebhooks[0]).not.toHaveProperty(
        "splitOptions"
      );
    });

    it("throws an error if the webhook is not found", async () => {
      discordWebhooksService.getWebhook.mockResolvedValue(null);

      await expect(
        service.updateDiscordWebhookConnection({
          feedId: createdFeed._id.toHexString(),
          connectionId: connectionIdToUse,
          updates: updateDetails,
          accessToken,
        })
      ).rejects.toThrowError(DiscordWebhookNonexistentException);
    });

    it("throws an error if the webhook cannot be used by the bot", async () => {
      discordWebhooksService.getWebhook.mockResolvedValue({
        token: "token",
      });
      discordWebhooksService.canBeUsedByBot.mockReturnValue(false);

      await expect(
        service.updateDiscordWebhookConnection({
          feedId: createdFeed._id.toHexString(),
          connectionId: connectionIdToUse,
          updates: updateDetails,
          accessToken,
        })
      ).rejects.toThrowError(DiscordWebhookInvalidTypeException);
    });

    it("throws an error if there is no webhook guild", async () => {
      discordWebhooksService.getWebhook.mockResolvedValue({
        token: "token",
      });
      discordWebhooksService.canBeUsedByBot.mockReturnValue(true);

      await expect(
        service.updateDiscordWebhookConnection({
          feedId: createdFeed._id.toHexString(),
          connectionId: connectionIdToUse,
          updates: updateDetails,
          accessToken,
        })
      ).rejects.toThrowError(DiscordWebhookMissingUserPermException);
    });

    it("throws an error if the user does not manage the guild", async () => {
      discordWebhooksService.getWebhook.mockResolvedValue({
        token: "token",
        guild_id: guildId,
      });
      discordWebhooksService.canBeUsedByBot.mockReturnValue(true);
      discordAuthService.userManagesGuild.mockResolvedValue(false);

      await expect(
        service.updateDiscordWebhookConnection({
          feedId: createdFeed._id.toHexString(),
          connectionId: connectionIdToUse,
          updates: updateDetails,
          accessToken,
        })
      ).rejects.toThrowError(DiscordWebhookMissingUserPermException);
    });

    it("throws an error on invalid filters", async () => {
      feedHandlerService.validateFilters.mockResolvedValue({
        errors: ["1", "2"],
      });

      await expect(
        service.updateDiscordWebhookConnection({
          feedId: createdFeed._id.toHexString(),
          connectionId: connectionIdToUse,
          updates: {
            filters: {
              expression: {},
            },
          },
          accessToken,
        })
      ).rejects.toThrowError(InvalidFilterExpressionException);
    });
  });

  describe("deleteDiscordWebhookConnection", () => {
    const connectionIdToUse = new Types.ObjectId().toHexString();
    let createdFeed: UserFeed;

    beforeEach(async () => {
      createdFeed = await userFeedModel.create({
        title: "my feed",
        url: "url",
        user: {
          discordUserId: "discord-user-id",
        },
        connections: {
          discordWebhooks: [
            {
              id: connectionIdToUse,
              name: "name",
              createdAt: new Date(),
              updatedAt: new Date(),
              details: {
                embeds: [],
                webhook: {
                  id: "old-webhook-id",
                  token: "old-token",
                  name: "old-webhook-name",
                  iconUrl: "old-icon-url",
                  guildId: "guild-id",
                },
                content: "old-content",
              },
            },
          ],
        },
      });
    });

    it("deletes connection", async () => {
      await service.deleteDiscordWebhookConnection({
        feedId: createdFeed._id.toHexString(),
        connectionId: connectionIdToUse,
      });

      const updatedFeed = await userFeedModel.findById(createdFeed._id).lean();

      expect(updatedFeed?.connections.discordWebhooks).toHaveLength(0);
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
        discordChannels: [],
        discordWebhooks: [
          {
            id: new Types.ObjectId(),
            name: "name",
            createdAt: new Date(),
            updatedAt: new Date(),
            details: {
              embeds: [],
              webhook: {
                id: "old-webhook-id",
                token: "old-token",
                name: "old-webhook-name",
                iconUrl: "old-icon-url",
                guildId: "guild-id",
              },
              content: "old-content",
            },
          },
        ],
      },
    }) as never;
    const targetConnection: DiscordWebhookConnection = Object.freeze(
      userFeed.connections.discordWebhooks[0]
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
            webhook: {
              id: targetConnection.details.webhook.id,
              token: targetConnection.details.webhook.token,
              iconUrl: targetConnection.details.webhook.iconUrl,
              name: targetConnection.details.webhook.name,
            },
            content: targetConnection.details.content,
            embeds: targetConnection.details.embeds,
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
          },
          article: {
            id: "1",
          },
          mediumDetails: {
            webhook: {
              id: targetConnection.details.webhook.id,
              token: targetConnection.details.webhook.token,
              iconUrl: targetConnection.details.webhook.iconUrl,
              name: targetConnection.details.webhook.name,
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

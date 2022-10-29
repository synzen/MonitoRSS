import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  DiscordWebhookInvalidTypeException,
  DiscordWebhookMissingUserPermException,
  DiscordWebhookNonexistentException,
  DiscordWebhookNotOwnedException,
} from "../../common/exceptions";
import {
  setupIntegrationTests,
  teardownIntegrationTests,
} from "../../utils/integration-tests";
import { MongooseTestModule } from "../../utils/mongoose-test.module";
import { DiscordAuthService } from "../discord-auth/discord-auth.service";
import { DiscordWebhooksService } from "../discord-webhooks/discord-webhooks.service";
import { Feed, FeedFeature } from "../feeds/entities/feed.entity";
import { FeedConnectionsDiscordWebhooksService } from "./feed-connections-discord-webhooks.service";

describe("FeedConnectionsDiscordWebhooksService", () => {
  let service: FeedConnectionsDiscordWebhooksService;
  let feedModel: Model<Feed>;
  const discordWebhooksService = {
    getWebhook: jest.fn(),
    canBeUsedByBot: jest.fn(),
  };
  const discordAuthService = {
    userManagesGuild: jest.fn(),
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
      ],
      imports: [
        MongooseTestModule.forRoot(),
        MongooseModule.forFeature([FeedFeature]),
      ],
    });

    const { module } = await init();

    service = module.get(FeedConnectionsDiscordWebhooksService);
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

  describe("createDiscordWebhookConnection", () => {
    let createdFeed: Feed;
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
      createdFeed = await feedModel.create({
        title: "my feed",
        channel: "688445354513137784",
        guild: "guild",
        isFeedv2: true,
        url: "url",
      });

      creationDetails = {
        accessToken: "access-token",
        feedId: createdFeed._id.toHexString(),
        guildId: createdFeed.guild,
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

      const updatedFeed = await feedModel.findById(createdFeed._id).lean();

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

    it("throws an error if webhook guild does not equal input", async () => {
      discordWebhooksService.getWebhook.mockResolvedValue({
        token: "token",
        guild_id: creationDetails.guildId + "-other",
      });
      discordWebhooksService.canBeUsedByBot.mockReturnValue(true);

      await expect(
        service.createDiscordWebhookConnection(creationDetails)
      ).rejects.toThrowError(DiscordWebhookNotOwnedException);
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
    let createdFeed: Feed;
    const guildId = "guild-id";
    const updateDetails = {
      filters: {
        expression: {
          foo: "new-filters",
        },
      },
      name: "new-name",
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

    beforeEach(async () => {
      createdFeed = await feedModel.create({
        title: "my feed",
        channel: "688445354513137784",
        guild: guildId,
        isFeedv2: true,
        url: "url",
        connections: {
          discordWebhooks: [
            {
              id: connectionIdToUse,
              name: "name",
              filters: {
                expression: {
                  foo: "bar",
                },
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
        guildId,
      });

      const updatedFeed = await feedModel.findById(createdFeed._id).lean();

      expect(updatedFeed?.connections.discordWebhooks).toHaveLength(1);
      expect(updatedFeed?.connections.discordWebhooks[0]).toMatchObject({
        id: new Types.ObjectId(connectionIdToUse),
        name: updateDetails.name,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        filters: updateDetails.filters,
        details: {
          embeds: updateDetails.details.embeds,
          webhook: {
            id: updateDetails.details.webhook.id,
            token: "token",
            name: updateDetails.details.webhook.name,
            iconUrl: updateDetails.details.webhook.iconUrl,
          },
          content: updateDetails.details.content,
        },
      });
    });

    it("throws an error if the webhook is not found", async () => {
      discordWebhooksService.getWebhook.mockResolvedValue(null);

      await expect(
        service.updateDiscordWebhookConnection({
          feedId: createdFeed._id.toHexString(),
          connectionId: connectionIdToUse,
          updates: updateDetails,
          guildId,
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
          guildId,
        })
      ).rejects.toThrowError(DiscordWebhookInvalidTypeException);
    });

    it("throws an error if webhook guild does not equal input", async () => {
      discordWebhooksService.getWebhook.mockResolvedValue({
        token: "token",
        guild_id: guildId + "-other",
      });
      discordWebhooksService.canBeUsedByBot.mockReturnValue(true);

      await expect(
        service.updateDiscordWebhookConnection({
          feedId: createdFeed._id.toHexString(),
          connectionId: connectionIdToUse,
          updates: updateDetails,
          guildId,
        })
      ).rejects.toThrowError(DiscordWebhookNotOwnedException);
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
          guildId,
        })
      ).rejects.toThrowError(DiscordWebhookMissingUserPermException);
    });
  });

  describe("deleteDiscordWebhookConnection", () => {
    const connectionIdToUse = new Types.ObjectId().toHexString();
    let createdFeed: Feed;
    const guildId = "guild-id";

    beforeEach(async () => {
      createdFeed = await feedModel.create({
        title: "my feed",
        channel: "688445354513137784",
        guild: guildId,
        isFeedv2: true,
        url: "url",
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

      const updatedFeed = await feedModel.findById(createdFeed._id).lean();

      expect(updatedFeed?.connections.discordWebhooks).toHaveLength(0);
    });
  });
});

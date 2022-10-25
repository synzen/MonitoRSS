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
import { FeedsService } from "../feeds/feeds.service";
import { FeedConnectionsService } from "./feed-connections.service";

describe("FeedConnectionsService", () => {
  let service: FeedConnectionsService;
  let feedModel: Model<Feed>;
  const feedsService = {
    canUseChannel: jest.fn(),
  };
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
        FeedConnectionsService,
        {
          provide: FeedsService,
          useValue: feedsService,
        },
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

    service = module.get(FeedConnectionsService);
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
    it("saves the new connection", async () => {
      const createdFeed = await feedModel.create({
        title: "my feed",
        channel: "688445354513137784",
        guild: "guild",
        isFeedv2: true,
        url: "url",
      });

      feedsService.canUseChannel.mockResolvedValue(true);

      const creationDetails = {
        feedId: createdFeed._id.toHexString(),
        channelId: createdFeed.channel,
        name: "name",
        userAccessToken: "user-access-token",
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
});

import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  setupIntegrationTests,
  teardownIntegrationTests,
} from "../../utils/integration-tests";
import { MongooseTestModule } from "../../utils/mongoose-test.module";
import { Feed, FeedFeature } from "../feeds/entities/feed.entity";
import { FeedsService } from "../feeds/feeds.service";
import { FeedConnectionsService } from "./feed-connections.service";

describe("FeedConnectionsService", () => {
  let service: FeedConnectionsService;
  let feedModel: Model<Feed>;
  const feedsService = {
    canUseChannel: jest.fn(),
  };

  beforeAll(async () => {
    const { init } = await setupIntegrationTests({
      providers: [
        FeedConnectionsService,
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
});

import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import { FeedFetcherService } from "../../services/feed-fetcher/feed-fetcher.service";
import {
  setupIntegrationTests,
  teardownIntegrationTests,
} from "../../utils/integration-tests";
import { MongooseTestModule } from "../../utils/mongoose-test.module";
import { DiscordAuthService } from "../discord-auth/discord-auth.service";
import { BannedFeedException } from "../feeds/exceptions";
import { FeedsService } from "../feeds/feeds.service";
import { UserFeed, UserFeedFeature, UserFeedModel } from "./entities";
import { UserFeedsService } from "./user-feeds.service";

describe("UserFeedsService", () => {
  let service: UserFeedsService;
  let userFeedModel: UserFeedModel;
  let feedFetcherService: FeedFetcherService;
  let discordAuthService: DiscordAuthService;
  let feedsService: FeedsService;

  beforeAll(async () => {
    const { uncompiledModule, init } = await setupIntegrationTests({
      providers: [
        FeedsService,
        FeedFetcherService,
        DiscordAuthService,
        UserFeedsService,
      ],
      imports: [
        MongooseTestModule.forRoot(),
        MongooseModule.forFeature([UserFeedFeature]),
      ],
    });

    uncompiledModule
      .overrideProvider(FeedFetcherService)
      .useValue({
        fetchFeed: jest.fn(),
      })
      .overrideProvider(DiscordAuthService)
      .useValue({
        getUser: jest.fn(),
      })
      .overrideProvider(FeedsService)
      .useValue({
        canUseChannel: jest.fn(),
        getBannedFeedDetails: jest.fn(),
      });

    const { module } = await init();

    service = module.get<UserFeedsService>(UserFeedsService);
    userFeedModel = module.get<UserFeedModel>(getModelToken(UserFeed.name));
    feedFetcherService = module.get<FeedFetcherService>(FeedFetcherService);
    discordAuthService = module.get<DiscordAuthService>(DiscordAuthService);
    feedsService = module.get<FeedsService>(FeedsService);
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterEach(async () => {
    await userFeedModel?.deleteMany({});
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  });

  describe("addFeed", () => {
    it("throws if feed is baned", async () => {
      jest
        .spyOn(feedsService, "getBannedFeedDetails")
        .mockResolvedValue({} as never);

      await expect(
        service.addFeed("123", {
          title: "title",
          url: "url",
        })
      ).rejects.toThrow(BannedFeedException);
    });

    it("throws if fetch feed throws", async () => {
      const err = new Error("fetch feed error");
      jest.spyOn(feedFetcherService, "fetchFeed").mockRejectedValue(err);

      await expect(
        service.addFeed("123", {
          title: "title",
          url: "url",
        })
      ).rejects.toThrow(err);
    });

    it("returns the created entity", async () => {
      jest
        .spyOn(feedFetcherService, "fetchFeed")
        .mockResolvedValue({} as never);

      const discordUser = {
        id: "123",
      };
      jest
        .spyOn(discordAuthService, "getUser")
        .mockResolvedValue(discordUser as never);

      const createDetails = {
        title: "title",
        url: "url",
      };
      const entity = await service.addFeed("123", createDetails);

      expect(entity).toMatchObject({
        title: "title",
        url: "url",
        user: {
          discordUserId: discordUser.id,
        },
      });
    });
  });
});

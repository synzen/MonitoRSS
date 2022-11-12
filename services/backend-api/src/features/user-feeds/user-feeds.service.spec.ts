import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { FeedFetcherService } from "../../services/feed-fetcher/feed-fetcher.service";
import {
  setupIntegrationTests,
  teardownIntegrationTests,
} from "../../utils/integration-tests";
import { MongooseTestModule } from "../../utils/mongoose-test.module";
import {
  BannedFeedException,
  FeedLimitReachedException,
} from "../feeds/exceptions";
import { FeedsService } from "../feeds/feeds.service";
import { SupportersService } from "../supporters/supporters.service";
import { UserFeed, UserFeedFeature, UserFeedModel } from "./entities";
import { FeedNotFailedException } from "./exceptions/feed-not-failed.exception";
import { UserFeedHealthStatus } from "./types";
import { UserFeedsService } from "./user-feeds.service";

describe("UserFeedsService", () => {
  let service: UserFeedsService;
  let userFeedModel: UserFeedModel;
  let feedFetcherService: FeedFetcherService;
  let feedsService: FeedsService;
  let supportersService: SupportersService;
  const discordUserId = "discordUserId";

  beforeAll(async () => {
    const { uncompiledModule, init } = await setupIntegrationTests({
      providers: [
        FeedsService,
        FeedFetcherService,
        UserFeedsService,
        SupportersService,
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
      .overrideProvider(FeedsService)
      .useValue({
        canUseChannel: jest.fn(),
        getBannedFeedDetails: jest.fn(),
      })
      .overrideProvider(SupportersService)
      .useValue({
        getBenefitsOfDiscordUser: jest.fn(),
      });

    const { module } = await init();

    service = module.get<UserFeedsService>(UserFeedsService);
    userFeedModel = module.get<UserFeedModel>(getModelToken(UserFeed.name));
    feedFetcherService = module.get<FeedFetcherService>(FeedFetcherService);
    feedsService = module.get<FeedsService>(FeedsService);
    supportersService = module.get<SupportersService>(SupportersService);
  });

  afterEach(() => {
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
        service.addFeed(
          {
            discordUserId: "123",
          },
          {
            title: "title",
            url: "url",
          }
        )
      ).rejects.toThrow(BannedFeedException);
    });

    it("throws if fetch feed throws", async () => {
      const err = new Error("fetch feed error");
      jest.spyOn(feedFetcherService, "fetchFeed").mockRejectedValue(err);

      await expect(
        service.addFeed(
          {
            discordUserId: "123",
          },
          {
            title: "title",
            url: "url",
          }
        )
      ).rejects.toThrow(err);
    });

    it("throws if user is at feed limit", async () => {
      jest
        .spyOn(supportersService, "getBenefitsOfDiscordUser")
        .mockResolvedValue({ maxFeeds: 1 } as never);

      await userFeedModel.create({
        user: {
          discordUserId,
        },
        title: "title",
        url: "url",
      });

      await expect(
        service.addFeed(
          {
            discordUserId,
          },
          {
            title: "title",
            url: "url",
          }
        )
      ).rejects.toThrow(FeedLimitReachedException);
    });

    it("returns the created entity", async () => {
      jest
        .spyOn(feedFetcherService, "fetchFeed")
        .mockResolvedValue({} as never);

      const createDetails = {
        title: "title",
        url: "url",
      };
      const entity = await service.addFeed(
        {
          discordUserId,
        },
        createDetails
      );

      expect(entity).toMatchObject({
        title: "title",
        url: "url",
        user: {
          discordUserId,
        },
      });
    });
  });

  describe("getFeedById", () => {
    it("returns the feed", async () => {
      const feed = await userFeedModel.create({
        title: "title",
        url: "url",
        user: {
          discordUserId: "123",
        },
      });

      const result = await service.getFeedById(feed.id);

      expect(result).toMatchObject({
        _id: feed._id,
        title: "title",
        url: "url",
        user: {
          discordUserId: "123",
        },
      });
    });

    it("returns null if feed does not exist", async () => {
      const result = await service.getFeedById(
        new Types.ObjectId().toHexString()
      );

      expect(result).toBeNull();
    });
  });

  describe("updateFeedById", () => {
    let feed: UserFeed;
    const updateBody = {
      title: "url",
      url: "url",
    };

    beforeEach(async () => {
      feed = await userFeedModel.create({
        title: "original title",
        url: "original url",
        user: {
          discordUserId,
        },
      });

      jest.spyOn(feedsService, "getBannedFeedDetails").mockResolvedValue(null);
    });

    it("throws if feed is baned", async () => {
      jest
        .spyOn(feedsService, "getBannedFeedDetails")
        .mockResolvedValue({} as never);

      await expect(
        service.updateFeedById(feed._id.toHexString(), updateBody)
      ).rejects.toThrow(BannedFeedException);
    });

    it("throws if fetch feed throws", async () => {
      const err = new Error("fetch feed error");
      jest.spyOn(feedFetcherService, "fetchFeed").mockRejectedValue(err);

      await expect(
        service.updateFeedById(feed._id.toHexString(), updateBody)
      ).rejects.toThrow(err);
    });

    it("returns the updated entity", async () => {
      jest
        .spyOn(feedFetcherService, "fetchFeed")
        .mockResolvedValue({} as never);

      const entity = await service.updateFeedById(
        feed._id.toHexString(),
        updateBody
      );

      expect(entity).toMatchObject({
        _id: feed._id,
        title: updateBody.title,
        url: updateBody.url,
        user: {
          discordUserId,
        },
      });
    });

    it("does not update anything if no updates are provided", async () => {
      const entity = await service.updateFeedById(feed._id.toHexString(), {});

      expect(entity).toMatchObject({
        _id: feed._id,
        title: feed.title,
        url: feed.url,
        user: {
          discordUserId,
        },
      });
    });
  });

  describe("deleteFeedById", () => {
    it("deletes the feed", async () => {
      const feed = await userFeedModel.create({
        title: "title",
        url: "url",
        user: {
          discordUserId: "123",
        },
      });

      await service.deleteFeedById(feed.id);

      const result = await userFeedModel.findById(feed.id);

      expect(result).toBeNull();
    });
  });

  describe("getFeedsByUser", () => {
    it("returns the feeds", async () => {
      const user = {
        discordUserId: "123",
      };
      const [feed] = await userFeedModel.create([
        {
          title: "title",
          url: "url",
          user,
        },
        {
          title: "title",
          url: "url",
          user: {
            discordUserId: user.discordUserId + "-other",
          },
        },
      ]);

      const result = await service.getFeedsByUser({
        userId: user.discordUserId,
      });

      expect(result).toMatchObject([
        {
          _id: feed._id,
          title: feed.title,
          url: feed.url,
          user,
        },
      ]);
    });

    it("works with search on title", async () => {
      const user = {
        discordUserId: "123",
      };
      const [, , feed3] = await userFeedModel.create([
        {
          title: "title1",
          url: "url1",
          user,
        },
        {
          title: "title2 HERE",
          url: "url2",
          user: {
            discordUserId: user.discordUserId + "-other",
          },
        },
        {
          title: "title2 HERE",
          url: "url3",
          user,
        },
      ]);

      const result = await service.getFeedsByUser({
        userId: user.discordUserId,
        search: "2 here",
      });

      expect(result).toHaveLength(1);
      expect(result).toMatchObject([
        {
          _id: feed3._id,
          title: feed3.title,
          url: feed3.url,
          user,
        },
      ]);
    });

    it("works with search on url", async () => {
      const user = {
        discordUserId: "123",
      };
      const [, , feed2] = await userFeedModel.create([
        {
          title: "title1",
          url: "url",
          user,
        },
        {
          title: "title2",
          url: "url HERE",
          user: {
            discordUserId: user.discordUserId + "-other",
          },
        },
        {
          title: "title3",
          url: "url HERE",
          user,
        },
      ]);

      const result = await service.getFeedsByUser({
        userId: user.discordUserId,
        search: "here",
      });

      expect(result).toHaveLength(1);
      expect(result).toMatchObject([
        {
          _id: feed2._id,
          title: feed2.title,
          url: feed2.url,
          user,
        },
      ]);
    });
  });

  it("works with offset and limit", async () => {
    const user = {
      discordUserId: "123",
    };
    const [feed1Id, feed2Id, feed3Id, feed4Id] = [
      new Types.ObjectId(),
      new Types.ObjectId(),
      new Types.ObjectId(),
      new Types.ObjectId(),
    ];

    await userFeedModel.collection.insertMany([
      {
        _id: feed1Id,
        title: "title1",
        url: "url1",
        user,
        createdAt: new Date(2020),
      },
      {
        _id: feed2Id,
        title: "title2",
        url: "url2",
        user,
        createdAt: new Date(2021),
      },
      {
        _id: feed3Id,
        title: "title3",
        url: "url3",
        user,
        createdAt: new Date(2022),
      },
      {
        _id: feed4Id,
        title: "title4",
        url: "url4",
        user,
        createdAt: new Date(2023),
      },
    ]);

    const result = await service.getFeedsByUser({
      userId: user.discordUserId,
      offset: 1,
      limit: 1,
    });

    expect(result).toHaveLength(1);
    expect(result).toMatchObject([
      {
        _id: feed3Id,
        title: "title3",
        url: "url3",
        user,
      },
    ]);
  });

  it('returns feeds in descending order by "createdAt"', async () => {
    const user = {
      discordUserId: "123",
    };
    const [feed1Id, feed2Id, feed3Id] = [
      new Types.ObjectId(),
      new Types.ObjectId(),
      new Types.ObjectId(),
      new Types.ObjectId(),
    ];

    await userFeedModel.collection.insertMany([
      {
        _id: feed1Id,
        title: "title1",
        url: "url1",
        user,
        createdAt: new Date(2020),
      },
      {
        _id: feed2Id,
        title: "title2",
        url: "url2",
        user,
        createdAt: new Date(2021),
      },
      {
        _id: feed3Id,
        title: "title3",
        url: "url3",
        user,
        createdAt: new Date(2022),
      },
    ]);

    const result = await service.getFeedsByUser({
      userId: user.discordUserId,
    });

    expect(result).toHaveLength(3);
    expect(result).toMatchObject([
      {
        _id: feed3Id,
        title: "title3",
        url: "url3",
        user,
      },
      {
        _id: feed2Id,
        title: "title2",
        url: "url2",
        user,
      },
      {
        _id: feed1Id,
        title: "title1",
        url: "url1",
        user,
      },
    ]);
  });

  describe("getFeedCountByUser", () => {
    it("returns the count of feeds owned by a user", async () => {
      const user = {
        discordUserId: "123",
      };
      await userFeedModel.create([
        {
          title: "title",
          url: "url",
          user,
        },
        {
          title: "title",
          url: "url",
          user: {
            discordUserId: user.discordUserId + "-other",
          },
        },
      ]);

      const result = await service.getFeedCountByUser({
        userId: user.discordUserId,
      });

      expect(result).toEqual(1);
    });

    it("works with search on title", async () => {
      const user = {
        discordUserId: "123",
      };
      await userFeedModel.create([
        {
          title: "title1",
          url: "url1",
          user,
        },
        {
          title: "title2 HERE",
          url: "url2",
          user: {
            discordUserId: user.discordUserId + "-other",
          },
        },
        {
          title: "title2 HERE",
          url: "url3",
          user,
        },
      ]);

      const result = await service.getFeedCountByUser({
        userId: user.discordUserId,
        search: "2 here",
      });

      expect(result).toEqual(1);
    });

    it("works with search on url", async () => {
      const user = {
        discordUserId: "123",
      };
      await userFeedModel.create([
        {
          title: "title1",
          url: "url",
          user,
        },
        {
          title: "title2",
          url: "url HERE",
          user: {
            discordUserId: user.discordUserId + "-other",
          },
        },
        {
          title: "title3",
          url: "url HERE",
          user,
        },
      ]);

      const result = await service.getFeedCountByUser({
        userId: user.discordUserId,
        search: "here",
      });

      expect(result).toEqual(1);
    });

    it("returns no results if no matches", async () => {
      const user = {
        discordUserId: "123",
      };
      await userFeedModel.create([
        {
          title: "title1",
          url: "url",
          user,
        },
        {
          title: "title2",
          url: "url HERE",
          user: {
            discordUserId: user.discordUserId + "-other",
          },
        },
      ]);

      const result = await service.getFeedCountByUser({
        userId: user.discordUserId,
        search: "no matches",
      });

      expect(result).toEqual(0);
    });
  });

  describe("retryFailedFeed", () => {
    it("throws an error if the feed is not found", async () => {
      await expect(
        service.retryFailedFeed(new Types.ObjectId().toHexString())
      ).rejects.toThrowError();
    });

    it("throws if the feed is not failed", async () => {
      const feed = await userFeedModel.create({
        title: "title",
        url: "url",
        user: {
          discordUserId: "user-id",
        },
        healthStatus: UserFeedHealthStatus.Ok,
      });

      await expect(
        service.retryFailedFeed(feed._id.toHexString())
      ).rejects.toThrowError(FeedNotFailedException);
    });

    it("sets the health status to ok if successful", async () => {
      const feed = await userFeedModel.create({
        title: "title",
        url: "url",
        user: {
          discordUserId: "user-id",
        },
        healthStatus: UserFeedHealthStatus.Failed,
      });

      await service.retryFailedFeed(feed._id.toHexString());

      const updatedFeed = await userFeedModel.findById(feed._id);

      expect(updatedFeed?.healthStatus).toEqual(UserFeedHealthStatus.Ok);
    });

    it("returns the updated feed", async () => {
      const feed = await userFeedModel.create({
        title: "title",
        url: "url",
        user: {
          discordUserId: "user-id",
        },
        healthStatus: UserFeedHealthStatus.Failed,
      });

      const result = await service.retryFailedFeed(feed._id.toHexString());

      expect(result).toEqual(
        expect.objectContaining({
          _id: feed._id,
          healthStatus: UserFeedHealthStatus.Ok,
        })
      );
    });
  });
});

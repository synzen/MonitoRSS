/* eslint-disable max-len */
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import dayjs from "dayjs";
import { Types } from "mongoose";
import { FeedFetcherApiService } from "../../services/feed-fetcher/feed-fetcher-api.service";
import { FeedFetcherService } from "../../services/feed-fetcher/feed-fetcher.service";
import { FeedHandlerService } from "../../services/feed-handler/feed-handler.service";
import { GetArticlesResponseRequestStatus } from "../../services/feed-handler/types";
import {
  setupIntegrationTests,
  teardownIntegrationTests,
} from "../../utils/integration-tests";
import { MongooseTestModule } from "../../utils/mongoose-test.module";
import { FeedConnectionDisabledCode } from "../feeds/constants";
import {
  DiscordChannelConnection,
  DiscordWebhookConnection,
} from "../feeds/entities/feed-connections";
import { FeedFeature } from "../feeds/entities/feed.entity";
import {
  BannedFeedException,
  FeedLimitReachedException,
} from "../feeds/exceptions";
import { FeedsService } from "../feeds/feeds.service";
import { LegacyFeedConversionJobFeature } from "../legacy-feed-conversion/entities/legacy-feed-conversion-job.entity";
import {
  UserFeedLimitOverride,
  UserFeedLimitOverrideFeature,
  UserFeedLimitOverrideModel,
} from "../supporters/entities/user-feed-limit-overrides.entity";
import { SupportersService } from "../supporters/supporters.service";
import { UserFeedComputedStatus } from "./constants/user-feed-computed-status.type";
import { GetUserFeedsInputDto, GetUserFeedsInputSortKey } from "./dto";
import { UserFeed, UserFeedFeature, UserFeedModel } from "./entities";
import { FeedNotFailedException } from "./exceptions/feed-not-failed.exception";
import { UserFeedDisabledCode, UserFeedHealthStatus } from "./types";
import { UserFeedsService } from "./user-feeds.service";
import { UserFeature } from "../users/entities/user.entity";
import { FeedConnectionsDiscordChannelsService } from "../feed-connections/feed-connections-discord-channels.service";
import { UsersService } from "../users/users.service";

const createMockDiscordChannelConnection: (
  overrideDetails?: Omit<Partial<DiscordChannelConnection>, "details"> & {
    details: Partial<DiscordChannelConnection["details"]>;
  }
) => DiscordChannelConnection = (overrideDetails) => ({
  id: new Types.ObjectId(),
  name: "name",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrideDetails,
  details: {
    channel: {
      id: "1",
      guildId: "guild",
    },
    embeds: [],
    formatter: {},
    ...overrideDetails?.details,
  },
});

const mockDiscordWebhookConnection: DiscordWebhookConnection = {
  id: new Types.ObjectId(),
  name: "name",
  createdAt: new Date(),
  updatedAt: new Date(),
  details: {
    webhook: {
      id: "1",
      guildId: "guild",
      token: "1",
    },
    embeds: [],
    formatter: {},
  },
};

describe("UserFeedsService", () => {
  let service: UserFeedsService;
  let userFeedModel: UserFeedModel;
  let userFeedLimitOverrideModel: UserFeedLimitOverrideModel;
  let feedFetcherService: FeedFetcherService;
  let feedsService: FeedsService;
  let feedHandlerService: FeedHandlerService;
  const discordUserId = "discordUserId";
  const supportersService = {
    getBenefitsOfDiscordUser: jest.fn(),
    defaultMaxUserFeeds: 2,
  };
  const usersService = {};

  beforeAll(async () => {
    const { uncompiledModule, init } = await setupIntegrationTests({
      providers: [
        FeedsService,
        FeedFetcherService,
        UserFeedsService,
        SupportersService,
        FeedHandlerService,
        {
          provide: AmqpConnection,
          useValue: {
            publish: jest.fn(),
          },
        },
        {
          provide: FeedFetcherApiService,
          useValue: {
            getRequests: jest.fn(),
          },
        },
        {
          provide: FeedConnectionsDiscordChannelsService,
          useValue: {
            deleteConnection: jest.fn(),
            cloneConnection: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: usersService,
        },
      ],
      imports: [
        MongooseTestModule.forRoot(),
        MongooseModule.forFeature([
          FeedFeature,
          LegacyFeedConversionJobFeature,
          UserFeedFeature,
          UserFeedLimitOverrideFeature,
          UserFeature,
        ]),
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
      .useValue(supportersService)
      .overrideProvider(FeedHandlerService)
      .useValue({
        getRateLimits: jest.fn(),
        initializeFeed: jest.fn(),
        getArticles: jest.fn(),
      });

    const { module } = await init();

    service = module.get<UserFeedsService>(UserFeedsService);
    userFeedModel = module.get<UserFeedModel>(getModelToken(UserFeed.name));
    userFeedLimitOverrideModel = module.get<UserFeedLimitOverrideModel>(
      getModelToken(UserFeedLimitOverride.name)
    );
    feedFetcherService = module.get<FeedFetcherService>(FeedFetcherService);
    feedsService = module.get<FeedsService>(FeedsService);
    feedHandlerService = module.get<FeedHandlerService>(FeedHandlerService);
  });

  beforeEach(() => {
    jest.spyOn(feedHandlerService, "getArticles").mockResolvedValue({
      requestStatus: GetArticlesResponseRequestStatus.Success,
      url: "",
      attemptedToResolveFromHtml: false,
    } as never);
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
    beforeEach(() => {
      jest
        .spyOn(supportersService, "getBenefitsOfDiscordUser")
        .mockResolvedValue({
          maxFeeds: 1,
          maxDailyArticles: 1,
        } as never);
    });

    it("throws if feed is baned", async () => {
      jest
        .spyOn(feedsService, "getBannedFeedDetails")
        .mockResolvedValue({} as never);

      await expect(
        service.addFeed(
          {
            discordUserId: "123",
            userAccessToken: "",
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
            userAccessToken: "",
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
        .mockResolvedValue({ maxUserFeeds: 1 } as never);

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
            userAccessToken: "",
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
          userAccessToken: "",
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

  describe("bulkDelete", () => {
    let created: UserFeed[];

    beforeEach(async () => {
      created = await userFeedModel.create([
        {
          title: "title1",
          url: "url",
          user: {
            discordUserId,
          },
        },
        {
          title: "title2",
          url: "url",
          user: {
            discordUserId,
          },
          legacyFeedId: new Types.ObjectId(),
        },
        {
          title: "title3",
          url: "url",
          user: {
            discordUserId: discordUserId + "-other",
          },
        },
      ]);
    });

    it("bulk deletes feeds of the discord user id", async () => {
      await service.bulkDelete(created.map((c) => c._id.toHexString()));

      const result = await userFeedModel.find({}).select("title").lean();

      expect(result).toHaveLength(1);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: "title3",
          }),
        ])
      );
    });

    it("returns the results", async () => {
      const inputIds = created.map((c) => c._id.toHexString());
      const results = await service.bulkDelete(inputIds);

      expect(results).toHaveLength(3);
      expect(results).toEqual([
        {
          id: inputIds[0],
          deleted: true,
        },
        {
          id: inputIds[1],
          deleted: true,
        },
        {
          id: inputIds[2],
          deleted: false,
        },
      ]);
    });

    it("adjusts limit overrides if legacy feeds were deleted", async () => {
      await userFeedLimitOverrideModel.create([
        {
          _id: discordUserId,
          additionalUserFeeds: 2,
        },
      ]);
      const inputIds = created.map((c) => c._id.toHexString());
      const results = await service.bulkDelete(inputIds);

      expect(results).toHaveLength(3);
      expect(results.filter((r) => r.isLegacy)).toHaveLength(1);

      const limitOverride = await userFeedLimitOverrideModel
        .findOne({
          _id: discordUserId,
        })
        .lean();

      expect(limitOverride).toMatchObject({
        additionalUserFeeds: 1,
      });
    });

    it("does not set override limit to negatives", async () => {
      await userFeedLimitOverrideModel.create([
        {
          _id: discordUserId,
          additionalUserFeeds: 0,
        },
      ]);
      const inputIds = created.map((c) => c._id.toHexString());
      const results = await service.bulkDelete(inputIds);

      expect(results).toHaveLength(3);
      expect(results.filter((r) => r.isLegacy)).toHaveLength(1);

      const limitOverride = await userFeedLimitOverrideModel
        .findOne({
          _id: discordUserId,
        })
        .lean();

      expect(limitOverride).toMatchObject({
        additionalUserFeeds: 0,
      });
    });
  });

  describe("bulkDisable", () => {
    let created: UserFeed[];

    beforeEach(async () => {
      created = await userFeedModel.create([
        {
          title: "title1",
          url: "url",
          user: {
            discordUserId,
          },
        },
        {
          title: "title2",
          url: "url",
          user: {
            discordUserId,
          },
        },
        {
          title: "title3",
          url: "url",
          user: {
            discordUserId: discordUserId + "-other",
          },
        },
        {
          title: "title3",
          url: "url",
          user: {
            discordUserId,
          },
          disabledCode: UserFeedDisabledCode.FailedRequests,
        },
      ]);
    });

    it("bulk disables feeds of the discord user id", async () => {
      await service.bulkDisable(created.map((c) => c._id.toHexString()));

      const result = await userFeedModel
        .find({
          disabledCode: UserFeedDisabledCode.Manual,
        })
        .select("title")
        .lean();

      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: "title1",
          }),
          expect.objectContaining({
            title: "title2",
          }),
        ])
      );
    });
  });

  describe("bulkEnable", () => {
    let created: UserFeed[];

    beforeEach(async () => {
      created = await userFeedModel.create([
        {
          title: "title1",
          url: "url",
          user: {
            discordUserId,
          },
          disabledCode: UserFeedDisabledCode.Manual,
        },
        {
          title: "title2",
          url: "url",
          user: {
            discordUserId,
          },
          disabledCode: UserFeedDisabledCode.Manual,
        },
        {
          title: "title3",
          url: "url",
          user: {
            discordUserId: discordUserId + "-other",
          },
          disabledCode: UserFeedDisabledCode.Manual,
        },
        {
          title: "title4",
          url: "url",
          user: {
            discordUserId,
          },
          disabledCode: UserFeedDisabledCode.FailedRequests,
        },
      ]);
    });

    it("bulk enables feeds of the discord user id", async () => {
      await service.bulkEnable(created.map((c) => c._id.toHexString()));

      const result = await userFeedModel
        .find({})
        .select(["title", "disabledCode"])
        .lean();

      expect(result).toHaveLength(4);
      const mapped = result.map((r) => ({
        title: r.title,
        disabledCode: r.disabledCode || null,
      }));

      expect(mapped).toEqual(
        expect.arrayContaining([
          {
            title: "title1",
            disabledCode: null,
          },
          {
            title: "title2",
            disabledCode: null,
          },
          {
            title: "title3",
            disabledCode: UserFeedDisabledCode.Manual,
          },
          {
            title: "title4",
            disabledCode: UserFeedDisabledCode.FailedRequests,
          },
        ])
      );
    });

    it("returns the results", async () => {
      const inputIds = created.map((c) => c._id.toHexString());
      const results = await service.bulkEnable(inputIds);

      expect(results).toHaveLength(4);
      expect(results).toEqual([
        {
          id: inputIds[0],
          enabled: true,
        },
        {
          id: inputIds[1],
          enabled: true,
        },
        {
          id: inputIds[2],
          enabled: false,
        },
        {
          id: inputIds[3],
          enabled: false,
        },
      ]);
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
    const userRefreshRateSeconds = 600;

    beforeEach(async () => {
      jest
        .spyOn(supportersService, "getBenefitsOfDiscordUser")
        .mockResolvedValue({
          refreshRateSeconds: userRefreshRateSeconds,
        });

      feed = await userFeedModel.create({
        title: "original title",
        url: "original url",
        user: {
          discordUserId,
        },
        refreshRateSeconds: userRefreshRateSeconds,
      });

      jest.spyOn(feedsService, "getBannedFeedDetails").mockResolvedValue(null);
    });

    it("throws if feed is baned", async () => {
      jest
        .spyOn(feedsService, "getBannedFeedDetails")
        .mockResolvedValue({} as never);

      await expect(
        service.updateFeedById(
          { disabledCode: undefined, id: feed._id.toHexString() },
          updateBody
        )
      ).rejects.toThrow(BannedFeedException);
    });

    it("throws if fetch feed throws", async () => {
      const err = new Error("fetch feed error");
      jest.spyOn(feedFetcherService, "fetchFeed").mockRejectedValue(err);

      await expect(
        service.updateFeedById(
          { disabledCode: undefined, id: feed._id.toHexString() },
          updateBody
        )
      ).rejects.toThrow(err);
    });

    it("returns the updated entity", async () => {
      jest
        .spyOn(feedFetcherService, "fetchFeed")
        .mockResolvedValue({} as never);

      const entity = await service.updateFeedById(
        { disabledCode: undefined, id: feed._id.toHexString() },
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

    it("unsets the refresh rate seconds if it is the original", async () => {
      await service.updateFeedById(
        { disabledCode: undefined, id: feed._id.toHexString() },
        {
          userRefreshRateSeconds: userRefreshRateSeconds,
        }
      );

      const found = await userFeedModel.findById(feed._id).lean();

      expect(found).not.toHaveProperty("userRefreshRateSeconds");
    });

    it("sets the refresh rate seconds if it is slower than the original", async () => {
      await service.updateFeedById(
        { disabledCode: undefined, id: feed._id.toHexString() },
        {
          userRefreshRateSeconds: userRefreshRateSeconds + 100,
        }
      );

      const found = await userFeedModel.findById(feed._id).lean();

      expect(found?.userRefreshRateSeconds).toBe(userRefreshRateSeconds + 100);
    });

    it("throws if the refresh rate seconds is faster than the original", async () => {
      await expect(
        service.updateFeedById(
          { disabledCode: undefined, id: feed._id.toHexString() },
          {
            userRefreshRateSeconds: userRefreshRateSeconds - 100,
          }
        )
      ).rejects.toThrowError();
    });

    it("sets null disabled code correctly", async () => {
      await service.updateFeedById(
        { disabledCode: undefined, id: feed._id.toHexString() },
        {
          disabledCode: null,
        }
      );

      const found = await userFeedModel.findById(feed._id).lean();

      expect(found).toBeTruthy();
      expect(found).not.toHaveProperty("disabledCode");
    });

    it("does not update anything if no updates are provided", async () => {
      const entity = await service.updateFeedById(
        { disabledCode: undefined, id: feed._id.toHexString() },
        {}
      );

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
    const dto: GetUserFeedsInputDto = {
      limit: 1000,
      offset: 0,
      sort: GetUserFeedsInputSortKey.CreatedAtDescending,
    };

    it("returns the feeds with extra fields", async () => {
      const user = {
        discordUserId: "123",
      };
      await userFeedModel.create([
        {
          title: "title0",
          url: "url",
          user,
        },
        {
          title: "title1",
          url: "url",
          user,
          disabledCode: UserFeedDisabledCode.ExceededFeedLimit,
        },
        {
          title: "title2",
          url: "url",
          user,
          disabledCode: UserFeedDisabledCode.Manual,
        },
        {
          title: "title3",
          url: "url",
          user: {
            discordUserId: user.discordUserId + "-other",
          },
        },
        {
          title: "title4",
          url: "url",
          user,
          connections: {
            discordChannels: [
              {
                ...createMockDiscordChannelConnection(),
                disabledCode: FeedConnectionDisabledCode.MissingMedium,
              },
            ],
          },
        },
        {
          title: "title5",
          url: "url",
          user,
          connections: {
            discordWebhooks: [
              {
                ...mockDiscordWebhookConnection,
                disabledCode: FeedConnectionDisabledCode.MissingPermissions,
              },
            ],
          },
        },
      ]);

      const result = await service.getFeedsByUser(user.discordUserId, dto);

      expect(result).toHaveLength(5);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: "title0",
            computedStatus: UserFeedComputedStatus.Ok,
          }),
          expect.objectContaining({
            title: "title1",
            computedStatus: UserFeedComputedStatus.RequiresAttention,
          }),
          expect.objectContaining({
            title: "title2",
            computedStatus: UserFeedComputedStatus.ManuallyDisabled,
          }),
          expect.objectContaining({
            title: "title4",
            computedStatus: UserFeedComputedStatus.RequiresAttention,
          }),
          expect.objectContaining({
            title: "title5",
            computedStatus: UserFeedComputedStatus.RequiresAttention,
          }),
        ])
      );
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

      const result = await service.getFeedsByUser(user.discordUserId, {
        ...dto,
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

      const result = await service.getFeedsByUser(user.discordUserId, {
        ...dto,
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

    it("works with disabled code filter", async () => {
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
          disabledCode: UserFeedDisabledCode.Manual,
        },
      ]);

      const result = await service.getFeedsByUser(user.discordUserId, {
        ...dto,
        filters: {
          disabledCodes: [UserFeedDisabledCode.Manual],
        },
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

      const result = await service.getFeedsByUser(user.discordUserId, {
        ...dto,
        limit: 1,
        offset: 1,
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

      const result = await service.getFeedsByUser(user.discordUserId, dto);

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

    it("works with computed status filters", async () => {
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
          connections: {
            discordChannels: [
              {
                ...createMockDiscordChannelConnection(),
                disabledCode: FeedConnectionDisabledCode.MissingMedium,
              },
            ],
          },
        },
        {
          title: "title4",
          url: "url HERE",
          user,
          healthStatus: UserFeedHealthStatus.Failing,
        },
      ]);

      const result = await service.getFeedsByUser(user.discordUserId, {
        ...dto,
        filters: {
          computedStatuses: [UserFeedComputedStatus.RequiresAttention],
        },
      });

      const retryingResult = await service.getFeedsByUser(user.discordUserId, {
        ...dto,
        filters: {
          computedStatuses: [UserFeedComputedStatus.Retrying],
        },
      });

      expect(result).toHaveLength(1);
      expect(result).toMatchObject([
        {
          title: "title3",
        },
      ]);
      expect(retryingResult).toHaveLength(1);
      expect(retryingResult).toMatchObject([
        {
          title: "title4",
        },
      ]);
    });

    it("works with connection disabled code filters", async () => {
      const user = {
        discordUserId: "123",
      };
      const [, , feed3, feed4] = await userFeedModel.create([
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
          connections: {
            discordChannels: [
              {
                id: new Types.ObjectId(),
                name: "name",
                createdAt: new Date(),
                updatedAt: new Date(),
                disabledCode: FeedConnectionDisabledCode.Manual,
                details: {
                  channel: {
                    id: "1",
                    guildId: "guild",
                  },
                  embeds: [],
                  formatter: {},
                },
              },
            ],
          },
        },
        {
          title: "title4",
          url: "url HERE",
          user,
          connections: {
            discordChannels: [
              {
                id: new Types.ObjectId(),
                name: "name",
                createdAt: new Date(),
                updatedAt: new Date(),
                details: {
                  channel: {
                    id: "1",
                    guildId: "guild",
                  },
                  embeds: [],
                  formatter: {},
                },
              },
            ],
            discordWebhooks: [
              {
                id: new Types.ObjectId(),
                name: "name",
                createdAt: new Date(),
                updatedAt: new Date(),
                disabledCode: FeedConnectionDisabledCode.Manual,
                details: {
                  webhook: {
                    id: "1",
                    guildId: "guild",
                    token: "token",
                  },
                  embeds: [],
                  formatter: {},
                },
              },
            ],
          },
        },
      ]);

      const result = await service.getFeedsByUser(user.discordUserId, {
        ...dto,
        filters: {
          connectionDisabledCodes: [FeedConnectionDisabledCode.Manual],
        },
      });

      expect(result).toHaveLength(2);
      expect(result).toMatchObject([
        {
          _id: feed3._id,
          title: feed3.title,
        },
        {
          _id: feed4._id,
          title: feed4.title,
        },
      ]);
    });

    it("works with connection disabled code filters being an empty string", async () => {
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
          connections: {
            discordChannels: [
              {
                id: new Types.ObjectId(),
                name: "name",
                createdAt: new Date(),
                updatedAt: new Date(),
                details: {
                  channel: {
                    id: "1",
                    guildId: "guild",
                  },
                  embeds: [],
                  formatter: {},
                },
              },
              {
                id: new Types.ObjectId(),
                name: "name2",
                createdAt: new Date(),
                updatedAt: new Date(),
                details: {
                  channel: {
                    id: "1",
                    guildId: "guild",
                  },
                  embeds: [],
                  formatter: {},
                },
              },
            ],
          },
        },
      ]);

      const result = await service.getFeedsByUser(user.discordUserId, {
        ...dto,
        filters: {
          connectionDisabledCodes: [""],
        },
      });

      expect(result).toHaveLength(2);
      expect(result).toMatchObject(
        expect.arrayContaining([
          expect.objectContaining({
            title: feed2.title,
          }),
          expect.objectContaining({
            title: "title1",
          }),
        ])
      );
    });
  });

  describe("getFeedCountByUser", () => {
    const dto = {};

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

      const result = await service.getFeedCountByUser(user.discordUserId, dto);

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

      const result = await service.getFeedCountByUser(user.discordUserId, {
        ...dto,
        search: "3",
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

      const result = await service.getFeedCountByUser(user.discordUserId, {
        ...dto,
        search: "here",
      });

      expect(result).toEqual(1);
    });

    it("works with search on disabledCode", async () => {
      const user = {
        discordUserId: "123",
      };
      await userFeedModel.create([
        {
          title: "title1",
          url: "url",
          user,
          disabledCode: UserFeedDisabledCode.Manual,
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

      const result = await service.getFeedCountByUser(user.discordUserId, {
        ...dto,
        filters: {
          disabledCodes: [UserFeedDisabledCode.Manual],
        },
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

      const result = await service.getFeedCountByUser(user.discordUserId, {
        ...dto,
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
        disabledCode: UserFeedDisabledCode.FailedRequests,
      });

      await service.retryFailedFeed(feed._id.toHexString());

      const updatedFeed = await userFeedModel.findById(feed._id);

      expect(updatedFeed?.healthStatus).toEqual(UserFeedHealthStatus.Ok);
      expect(updatedFeed?.disabledCode).toBeUndefined();
    });

    it("returns the updated feed", async () => {
      const feed = await userFeedModel.create({
        title: "title",
        url: "url",
        user: {
          discordUserId: "user-id",
        },
        healthStatus: UserFeedHealthStatus.Failed,
        disabledCode: UserFeedDisabledCode.FailedRequests,
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

  describe("getEnforceWebhookWrites", () => {
    it("disables webhooks if the user is not a supporter", async () => {
      const secondDiscordUserId = discordUserId + "2";
      const thirdDiscordUserId = discordUserId + "3";
      const created = await userFeedModel.create([
        {
          title: "title1",
          url: "url",
          user: {
            discordUserId: discordUserId,
          },
          refreshRateSeconds: 600,
          connections: {
            discordChannels: [
              {
                ...createMockDiscordChannelConnection({
                  details: {
                    webhook: {
                      id: "1",
                      guildId: "1",
                      token: "1",
                    },
                  },
                }),
                disabledCode: FeedConnectionDisabledCode.MissingMedium,
              },
              {
                ...createMockDiscordChannelConnection({
                  details: {
                    webhook: {
                      id: "1",
                      guildId: "1",
                      token: "1",
                    },
                  },
                }),
              },
              {
                ...createMockDiscordChannelConnection(),
              },
            ],
          },
        },
        {
          title: "title2",
          url: "url",
          user: {
            discordUserId: secondDiscordUserId,
          },
          refreshRateSeconds: 600,
          connections: {
            discordChannels: [
              {
                ...createMockDiscordChannelConnection({
                  details: {
                    webhook: {
                      id: "1",
                      guildId: "1",
                      token: "1",
                    },
                  },
                }),
              },
            ],
          },
        },
        {
          title: "title3",
          url: "url",
          user: {
            discordUserId: thirdDiscordUserId,
          },
          refreshRateSeconds: 600,
          connections: {
            discordChannels: [
              {
                ...createMockDiscordChannelConnection({
                  details: {
                    webhook: {
                      id: "1",
                      guildId: "1",
                      token: "1",
                    },
                  },
                }),
              },
            ],
          },
        },
      ]);

      const writes = service.getEnforceWebhookWrites({
        enforcementType: "all-users",
        supporterDiscordUserIds: [secondDiscordUserId],
      });

      await userFeedModel.bulkWrite(writes);

      const updatedFeeds = await userFeedModel
        .find({
          _id: {
            $in: created.map((c) => c._id),
          },
        })
        .lean();

      expect(updatedFeeds).toHaveLength(3);
      // first user's webhook connections should be disabled
      expect(
        updatedFeeds[0].connections?.discordChannels[0].disabledCode
      ).toEqual(FeedConnectionDisabledCode.NotPaidSubscriber);
      expect(
        updatedFeeds[0].connections?.discordChannels[1].disabledCode
      ).toEqual(FeedConnectionDisabledCode.NotPaidSubscriber);
      expect(
        updatedFeeds[0].connections?.discordChannels[2].disabledCode
      ).toEqual(FeedConnectionDisabledCode.NotPaidSubscriber);

      // second user's webhook connection should be enabled
      expect(
        updatedFeeds[1].connections?.discordChannels[0].disabledCode
      ).toBeUndefined();

      // third user's webhook connection should be disabled
      expect(
        updatedFeeds[2].connections?.discordChannels[0].disabledCode
      ).toEqual(FeedConnectionDisabledCode.NotPaidSubscriber);
    });

    it("does not disable manually-disabled webohook connections if user is not a supporter", async () => {
      const created = await userFeedModel.create([
        {
          title: "title1",
          url: "url",
          user: {
            discordUserId,
          },
          refreshRateSeconds: 600,
          connections: {
            discordChannels: [
              {
                ...createMockDiscordChannelConnection({
                  disabledCode: FeedConnectionDisabledCode.Manual,
                  details: {
                    webhook: {
                      id: "1",
                      guildId: "1",
                      token: "1",
                    },
                  },
                }),
              },
            ],
          },
        },
      ]);

      const writes = service.getEnforceWebhookWrites({
        enforcementType: "all-users",
        supporterDiscordUserIds: [],
      });

      await userFeedModel.bulkWrite(writes);

      const updatedFeeds = await userFeedModel
        .find({
          _id: {
            $in: created.map((c) => c._id),
          },
        })
        .lean();

      expect(updatedFeeds).toHaveLength(1);
      expect(
        updatedFeeds[0].connections?.discordChannels[0].disabledCode
      ).toEqual(FeedConnectionDisabledCode.Manual);
    });

    it("enables webhooks if the user is a supporter", async () => {
      const created = await userFeedModel.create([
        {
          title: "title1",
          url: "url",
          user: {
            discordUserId,
          },
          refreshRateSeconds: 600,
          connections: {
            discordChannels: [
              {
                ...createMockDiscordChannelConnection({
                  disabledCode: FeedConnectionDisabledCode.NotPaidSubscriber,
                  details: {
                    webhook: {
                      id: "1",
                      guildId: "1",
                      token: "1",
                    },
                  },
                }),
              },
            ],
          },
        },
      ]);

      const writes = service.getEnforceWebhookWrites({
        enforcementType: "all-users",
        supporterDiscordUserIds: [discordUserId],
      });

      await userFeedModel.bulkWrite(writes);

      const updatedFeeds = await userFeedModel
        .find({
          _id: {
            $in: created.map((c) => c._id),
          },
        })
        .lean();

      expect(updatedFeeds).toHaveLength(1);
      expect(
        updatedFeeds[0].connections?.discordChannels[0].disabledCode
      ).toBeUndefined();
    });
  });

  describe("enforceAllUserFeedLimits", () => {
    describe("supporter limits", () => {
      it("enforces feed limits correctly", async () => {
        const feed = await userFeedModel.create([
          {
            title: "title1",
            url: "url",
            user: {
              discordUserId: discordUserId,
            },
            refreshRateSeconds: 600,
          },
          {
            title: "title2",
            url: "url",
            user: {
              discordUserId: discordUserId,
            },
            refreshRateSeconds: 600,
          },
          {
            title: "title3",
            url: "url",
            user: {
              discordUserId: discordUserId,
            },
            refreshRateSeconds: 600,
          },
        ]);

        await userFeedModel.collection.updateOne(
          {
            _id: feed[1]._id,
          },
          {
            $set: {
              createdAt: dayjs().subtract(5, "days"),
            },
          }
        );

        await userFeedModel.collection.updateOne(
          {
            _id: feed[2]._id,
          },
          {
            $set: {
              createdAt: dayjs().subtract(10, "days"),
            },
          }
        );

        await service.enforceAllUserFeedLimits([
          {
            discordUserId,
            maxUserFeeds: 2,
            refreshRateSeconds: 600,
          },
        ]);

        const result = await userFeedModel
          .find({
            disabledCode: UserFeedDisabledCode.ExceededFeedLimit,
            "user.discordUserId": discordUserId,
          })
          .select("title")
          .lean();

        expect(result).toHaveLength(1);

        expect(result).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              title: feed[2].title,
            }),
          ])
        );
      });

      it("enforces feed limits with manually disabled feeds correctly", async () => {
        await userFeedModel.create([
          {
            title: "title1",
            url: "url",
            user: {
              discordUserId: discordUserId,
            },
            refreshRateSeconds: 600,
          },
          {
            title: "title2",
            url: "url",
            user: {
              discordUserId: discordUserId,
            },
            refreshRateSeconds: 600,
            disabledCode: UserFeedDisabledCode.Manual,
          },
          {
            title: "title3",
            url: "url",
            user: {
              discordUserId: discordUserId,
            },
            refreshRateSeconds: 600,
          },
        ]);

        await service.enforceAllUserFeedLimits([
          {
            discordUserId,
            maxUserFeeds: 2,
            refreshRateSeconds: 600,
          },
        ]);

        const result = await userFeedModel
          .find({
            disabledCode: UserFeedDisabledCode.ExceededFeedLimit,
            "user.discordUserId": discordUserId,
          })
          .select("title")
          .lean();

        expect(result).toHaveLength(0);
      });

      it("should not enable manually disabled codes while enforcing limits", async () => {
        await userFeedModel.create([
          {
            title: "title1",
            url: "url",
            user: {
              discordUserId: discordUserId,
            },
            refreshRateSeconds: 600,
            disabledCode: UserFeedDisabledCode.Manual,
          },
          {
            title: "title2",
            url: "url",
            user: {
              discordUserId: discordUserId,
            },
            refreshRateSeconds: 600,
            disabledCode: UserFeedDisabledCode.Manual,
          },
          {
            title: "title3",
            url: "url",
            user: {
              discordUserId: discordUserId,
            },
            refreshRateSeconds: 600,
            disabledCode: UserFeedDisabledCode.Manual,
          },
        ]);

        await service.enforceAllUserFeedLimits([
          {
            discordUserId,
            maxUserFeeds: 2,
            refreshRateSeconds: 600,
          },
        ]);

        const result = await userFeedModel
          .find({
            disabledCode: UserFeedDisabledCode.Manual,
            "user.discordUserId": discordUserId,
          })
          .select("title")
          .lean();

        expect(result).toHaveLength(3);
      });

      it("does not disable any feeds if not over limit", async () => {
        const feed = await userFeedModel.create([
          {
            title: "title1",
            url: "url",
            user: {
              discordUserId: discordUserId,
            },
            refreshRateSeconds: 600,
          },
          {
            title: "title2",
            url: "url",
            user: {
              discordUserId: discordUserId,
            },
            refreshRateSeconds: 600,
          },
        ]);

        await service.enforceAllUserFeedLimits([
          {
            discordUserId: discordUserId,
            maxUserFeeds: 3,
            refreshRateSeconds: 600,
          },
        ]);

        const result = await userFeedModel
          .find({
            "user.discordUserId": discordUserId,
            disabledCode: { $exists: false },
          })
          .select("title")
          .lean();

        expect(result).toHaveLength(2);
        const titles = result.map((r) => r.title);

        expect(titles).toEqual(
          expect.arrayContaining([feed[0].title, feed[1].title])
        );
      });

      it("does not enable feeds disabled for other reasons if user is under limit with disabled feeds", async () => {
        const feeds = await userFeedModel.create([
          {
            title: "title1",
            url: "url",
            user: {
              discordUserId,
            },
            disabledCode: UserFeedDisabledCode.BadFormat,
            refreshRateSeconds: 600,
          },
          {
            title: "title2",
            url: "url",
            user: {
              discordUserId,
            },
            disabledCode: UserFeedDisabledCode.BadFormat,
            refreshRateSeconds: 600,
          },
          {
            title: "title3",
            url: "url",
            user: {
              discordUserId,
            },
            disabledCode: UserFeedDisabledCode.ExceededFeedLimit,
            refreshRateSeconds: 600,
          },
        ]);

        await service.enforceAllUserFeedLimits([
          {
            discordUserId: discordUserId,
            maxUserFeeds: 1,
            refreshRateSeconds: 600,
          },
        ]);

        const result = await userFeedModel
          .find({
            "user.discordUserId": discordUserId,
          })
          .select(["title", "disabledCode"])
          .lean();

        expect(result).toHaveLength(3);
        const disabledCodes = result.map((r) => r.disabledCode);

        expect(disabledCodes).toEqual(
          expect.arrayContaining([
            feeds[0].disabledCode,

            feeds[1].disabledCode,
            feeds[2].disabledCode,
          ])
        );
      });
    });

    it("does not enable manually disabled feeds if user is under limit", async () => {
      await userFeedModel.create([
        {
          title: "title1",
          url: "url",
          user: {
            discordUserId,
          },
          disabledCode: UserFeedDisabledCode.Manual,
          refreshRateSeconds: 600,
        },
        {
          title: "title2",
          url: "url",
          user: {
            discordUserId,
          },
          disabledCode: UserFeedDisabledCode.Manual,
          refreshRateSeconds: 600,
        },
        {
          title: "title3",
          url: "url",
          user: {
            discordUserId,
          },
          disabledCode: UserFeedDisabledCode.Manual,
          refreshRateSeconds: 600,
        },
      ]);

      await service.enforceAllUserFeedLimits([
        {
          discordUserId: discordUserId,
          maxUserFeeds: 1,
          refreshRateSeconds: 600,
        },
      ]);

      const result = await userFeedModel
        .find({
          "user.discordUserId": discordUserId,
          disabledCode: UserFeedDisabledCode.Manual,
        })
        .select(["title", "disabledCode"])
        .lean();

      expect(result).toHaveLength(3);
    });

    describe("default limits", () => {
      it("disables over-limit feeds for non-supporters", async () => {
        await userFeedModel.create([
          {
            title: "title1",
            url: "url",
            user: {
              discordUserId: discordUserId,
            },
          },
          {
            title: "title2",
            url: "url",
            user: {
              discordUserId: discordUserId,
            },
          },
          {
            title: "title3",
            url: "url",
            user: {
              discordUserId: discordUserId,
            },
          },
        ]);

        await service.enforceAllUserFeedLimits([]);

        const result = await userFeedModel
          .find({
            disabledCode: {
              $exists: false,
            },
            "user.discordUserId": discordUserId,
          })
          .select("title")
          .lean();

        expect(result).toHaveLength(supportersService.defaultMaxUserFeeds);
      });

      it("treats manually disabled as same as exceeded feed limit", async () => {
        await userFeedModel.create([
          {
            title: "title1",
            url: "url",
            user: {
              discordUserId: discordUserId,
            },
          },
          {
            title: "title2",
            url: "url",
            user: {
              discordUserId: discordUserId,
            },
            disabledCode: UserFeedDisabledCode.Manual,
          },
          {
            title: "title3",
            url: "url",
            user: {
              discordUserId: discordUserId,
            },
          },
        ]);

        await service.enforceAllUserFeedLimits([]);

        const result = await userFeedModel
          .find({
            disabledCode: {
              $exists: false,
            },
            "user.discordUserId": discordUserId,
          })
          .select("title")
          .lean();

        expect(result).toHaveLength(supportersService.defaultMaxUserFeeds);

        const manuallyDisabled = await userFeedModel
          .find({
            disabledCode: UserFeedDisabledCode.Manual,
            "user.discordUserId": discordUserId,
          })
          .select("title")
          .lean();

        expect(manuallyDisabled).toHaveLength(1);
      });

      it("enables feeds if user is under limit with disabled feeds", async () => {
        const feeds = await userFeedModel.create([
          {
            title: "title1",
            url: "url",
            user: {
              discordUserId: discordUserId,
            },
            disabledCode: UserFeedDisabledCode.ExceededFeedLimit,
          },
          {
            title: "title2",
            url: "url",
            user: {
              discordUserId: discordUserId,
            },
            disabledCode: UserFeedDisabledCode.ExceededFeedLimit,
          },
          {
            title: "title3",
            url: "url",
            user: {
              discordUserId: discordUserId,
            },
            disabledCode: UserFeedDisabledCode.ExceededFeedLimit,
          },
        ]);

        await userFeedModel.collection.updateOne(
          {
            _id: feeds[0]._id,
          },
          {
            $set: {
              createdAt: dayjs().subtract(10, "days").toDate(),
            },
          }
        );

        await userFeedModel.collection.updateOne(
          {
            _id: feeds[1]._id,
          },
          {
            $set: {
              createdAt: dayjs().subtract(5, "days").toDate(),
            },
          }
        );

        await service.enforceAllUserFeedLimits([]);

        const result = await userFeedModel
          .find({
            "user.discordUserId": discordUserId,
            disabledCode: { $exists: false },
          })
          .select("title")
          .lean();

        expect(result).toHaveLength(2);
        const titles = result.map((r) => r.title);

        expect(titles).toEqual(
          expect.arrayContaining([feeds[1].title, feeds[2].title])
        );
      });

      it("does not enable feeds disabled for other reasons if user is under limit with disabled feeds", async () => {
        const feeds = await userFeedModel.create([
          {
            title: "title1",
            url: "url",
            user: {
              discordUserId: discordUserId,
            },
            disabledCode: UserFeedDisabledCode.BadFormat,
          },
          {
            title: "title2",
            url: "url",
            user: {
              discordUserId: discordUserId,
            },
            disabledCode: UserFeedDisabledCode.ExcessivelyActive,
          },
          {
            title: "title3",
            url: "url",
            user: {
              discordUserId: discordUserId,
            },
            disabledCode: UserFeedDisabledCode.ExceededFeedLimit,
          },
        ]);

        await service.enforceAllUserFeedLimits([]);

        const result = await userFeedModel
          .find({
            "user.discordUserId": discordUserId,
          })
          .select(["disabledCode"])
          .lean();

        expect(result).toHaveLength(3);

        const disabledCodes = result.map((r) => r.disabledCode);

        expect(disabledCodes).toEqual(
          expect.arrayContaining([
            feeds[0].disabledCode,
            feeds[1].disabledCode,
            feeds[2].disabledCode,
          ])
        );
      });
    });
  });
});

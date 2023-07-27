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
import {
  BannedFeedException,
  FeedLimitReachedException,
} from "../feeds/exceptions";
import { FeedsService } from "../feeds/feeds.service";
import { SupportersService } from "../supporters/supporters.service";
import { UserFeedComputedStatus } from "./constants/user-feed-computed-status.type";
import { GetUserFeedsInputDto, GetUserFeedsInputSortKey } from "./dto";
import { UserFeed, UserFeedFeature, UserFeedModel } from "./entities";
import { FeedNotFailedException } from "./exceptions/feed-not-failed.exception";
import {
  GetFeedArticlesInput,
  UserFeedDisabledCode,
  UserFeedHealthStatus,
} from "./types";
import { UserFeedsService } from "./user-feeds.service";

const mockDiscordChannelConnection: DiscordChannelConnection = {
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
};

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
  let feedFetcherService: FeedFetcherService;
  let feedsService: FeedsService;
  let feedHandlerService: FeedHandlerService;
  const discordUserId = "discordUserId";
  const supportersService = {
    getBenefitsOfDiscordUser: jest.fn(),
    defaultMaxUserFeeds: 2,
  };

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
    feedFetcherService = module.get<FeedFetcherService>(FeedFetcherService);
    feedsService = module.get<FeedsService>(FeedsService);
    feedHandlerService = module.get<FeedHandlerService>(FeedHandlerService);
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

    it("initializes the feed with the feed handler service", async () => {
      jest
        .spyOn(feedFetcherService, "fetchFeed")
        .mockResolvedValue({} as never);

      jest
        .spyOn(supportersService, "getBenefitsOfDiscordUser")
        .mockResolvedValue({ maxFeeds: 1, maxDailyArticles: 105 } as never);

      const createDetails = {
        title: "title",
        url: "url",
      };
      await service.addFeed(
        {
          discordUserId,
        },
        createDetails
      );

      expect(feedHandlerService.initializeFeed).toHaveBeenCalledWith(
        expect.any(String),
        {
          maxDailyArticles: 105,
        }
      );
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
      await service.bulkDelete(
        created.map((c) => c._id.toHexString()),
        discordUserId
      );

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
      const results = await service.bulkDelete(inputIds, discordUserId);

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
      await service.bulkDisable(
        created.map((c) => c._id.toHexString()),
        discordUserId
      );

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
      await service.bulkEnable(
        created.map((c) => c._id.toHexString()),
        discordUserId
      );

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
      const results = await service.bulkEnable(inputIds, discordUserId);

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

    it("sets null disabled code correctly", async () => {
      await service.updateFeedById(feed._id.toHexString(), {
        disabledCode: null,
      });

      const found = await userFeedModel.findById(feed._id).lean();

      expect(found).toBeTruthy();
      expect(found).not.toHaveProperty("disabledCode");
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
                ...mockDiscordChannelConnection,
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
                ...mockDiscordChannelConnection,
                disabledCode: FeedConnectionDisabledCode.MissingMedium,
              },
            ],
          },
        },
      ]);

      const result = await service.getFeedsByUser(user.discordUserId, {
        ...dto,
        filters: {
          computedStatuses: [UserFeedComputedStatus.RequiresAttention],
        },
      });

      expect(result).toHaveLength(1);
      expect(result).toMatchObject([
        {
          title: "title3",
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

  describe("getFeedDailyLimit", () => {
    it("returns only the daily rate limits", async () => {
      jest.spyOn(feedHandlerService, "getRateLimits").mockResolvedValue({
        results: {
          limits: [
            {
              max: 100,
              progress: 10,
              remaining: 90,
              windowSeconds: 60,
            },
            {
              max: 10,
              progress: 1,
              remaining: 9,
              windowSeconds: 86400,
            },
          ],
        },
      });

      const result = await service.getFeedDailyLimit("url");

      expect(result).toEqual({
        max: 10,
        progress: 1,
        remaining: 9,
        windowSeconds: 86400,
      });
    });
  });

  describe("getFeedArticles", () => {
    const validInput: GetFeedArticlesInput = {
      limit: 1,
      random: true,
      url: "random-url",
      formatter: {
        options: {
          formatTables: false,
          stripImages: false,
          dateFormat: "foo",
          dateTimezone: "bar",
          disableImageLinkPreviews: false,
        },
      },
    };

    it("returns correctly", async () => {
      const returned = {
        requestStatus: GetArticlesResponseRequestStatus.Success,
        articles: [],
        totalArticles: 0,
        selectedProperties: [],
      };

      jest.spyOn(feedHandlerService, "getArticles").mockResolvedValue(returned);

      const result = await service.getFeedArticles(validInput);

      expect(result).toEqual(returned);
    });
  });

  describe("getFeedArticleProperties", () => {
    it("returns correctly", async () => {
      jest.spyOn(feedHandlerService, "getArticles").mockResolvedValue({
        requestStatus: "foo",
        articles: [
          {
            a: "1",
          },
          {
            b: "2",
            a: "a",
          },
          {
            c: "3",
          },
        ],
      } as never);

      const result = await service.getFeedArticleProperties({
        url: "url",
      });

      expect(result).toEqual({
        requestStatus: "foo",
        properties: ["a", "b", "c"],
      });
    });

    it("returns sorts the returned properties", async () => {
      jest.spyOn(feedHandlerService, "getArticles").mockResolvedValue({
        requestStatus: "foo",
        articles: [
          {
            z: "1",
          },
          {
            c: "2",
            a: "a",
          },
          {
            b: "3",
          },
        ],
      } as never);

      const result = await service.getFeedArticleProperties({
        url: "url",
      });

      expect(result).toEqual({
        requestStatus: "foo",
        properties: ["a", "b", "c", "z"],
      });
    });
  });

  describe("enforceUserFeedLimits", () => {
    describe("supporter limits", () => {
      it("enforces feed limits correctly", async () => {
        const feed = await userFeedModel.create([
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

        await service.enforceUserFeedLimits([
          {
            discordUserId,
            maxUserFeeds: 2,
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

      it("does not disable any feeds if not over limit", async () => {
        const feed = await userFeedModel.create([
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
        ]);

        await service.enforceUserFeedLimits([
          {
            discordUserId: discordUserId,
            maxUserFeeds: 3,
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
          },
          {
            title: "title2",
            url: "url",
            user: {
              discordUserId,
            },
            disabledCode: UserFeedDisabledCode.BadFormat,
          },
          {
            title: "title3",
            url: "url",
            user: {
              discordUserId,
            },
            disabledCode: UserFeedDisabledCode.ExceededFeedLimit,
          },
        ]);

        await service.enforceUserFeedLimits([
          {
            discordUserId: discordUserId,
            maxUserFeeds: 1,
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

        await service.enforceUserFeedLimits([]);

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

        await service.enforceUserFeedLimits([]);

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

        await service.enforceUserFeedLimits([]);

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

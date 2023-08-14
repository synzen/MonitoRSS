import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import { TestingModule } from "@nestjs/testing";
import {
  setupIntegrationTests,
  teardownIntegrationTests,
} from "../../utils/integration-tests";
import { MongooseTestModule } from "../../utils/mongoose-test.module";

import { Types } from "mongoose";
import { ScheduleHandlerModule } from "./schedule-handler.module";
import { ScheduleHandlerService } from "./schedule-handler.service";
import {
  FeedSchedule,
  FeedScheduleModel,
} from "../feeds/entities/feed-schedule.entity";
import {
  UserFeed,
  UserFeedFeature,
  UserFeedModel,
} from "../user-feeds/entities";
import {
  UserFeedDisabledCode,
  UserFeedHealthStatus,
} from "../user-feeds/types";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { SupportersService } from "../supporters/supporters.service";
import { ArticleRejectCode } from "./constants";
import { FeedConnectionDisabledCode } from "../feeds/constants";
import { UserFeedsService } from "../user-feeds/user-feeds.service";

jest.mock("../../utils/logger");

const sampleConnections: UserFeed["connections"] = {
  discordWebhooks: [],
  discordChannels: [
    {
      id: new Types.ObjectId(),
      name: "connection-name",
      filters: {
        expression: {
          foo: "bar",
        },
      },
      details: {
        embeds: [],
        channel: {
          id: "channel-id",
          guildId: "guild-id",
        },
        formatter: {
          formatTables: false,
          stripImages: true,
        },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
};

describe("handle-schedule", () => {
  let module: TestingModule;
  let userFeedModel: UserFeedModel;
  let feedScheduleModel: FeedScheduleModel;
  let service: ScheduleHandlerService;
  let supportersService: SupportersService;
  const amqpConnection = {
    publish: jest.fn(),
  };
  const userFeedsService = {
    enforceUserFeedLimits: jest.fn(),
  };

  beforeAll(async () => {
    const { init, uncompiledModule } = await setupIntegrationTests({
      providers: [],
      imports: [
        MongooseTestModule.forRoot(),
        MongooseModule.forFeature([UserFeedFeature]),
        ScheduleHandlerModule.forRoot(),
      ],
    });

    uncompiledModule
      .overrideProvider(AmqpConnection)
      .useValue(amqpConnection)
      .overrideProvider(UserFeedsService)
      .useValue(userFeedsService);

    ({ module } = await init());
    userFeedModel = module.get<UserFeedModel>(getModelToken(UserFeed.name));
    feedScheduleModel = module.get<FeedScheduleModel>(
      getModelToken(FeedSchedule.name)
    );
    service = module.get<ScheduleHandlerService>(ScheduleHandlerService);
    supportersService = module.get<SupportersService>(SupportersService);
    service.defaultRefreshRateSeconds = 600;
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    jest
      .spyOn(supportersService, "getBenefitsOfAllDiscordUsers")
      .mockResolvedValue([]);
    await userFeedModel.deleteMany();
    await feedScheduleModel.deleteMany();
  });

  afterAll(async () => {
    await teardownIntegrationTests();
    await module?.close();
  });

  describe("handleRefreshRate", () => {
    it("calls the handlers for feeds with default refresh rate", async () => {
      const createdFeeds = await userFeedModel.create([
        {
          title: "feed-title",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id",
          },
          connections: sampleConnections,
        },
        {
          title: "feed-title-2",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id",
          },
          connections: sampleConnections,
        },
      ]);

      const urlsHandler = jest.fn();
      const feedHandler = jest.fn();

      await service.handleRefreshRate(service.defaultRefreshRateSeconds, {
        urlsHandler,
        feedHandler,
      });

      expect(urlsHandler).toHaveBeenCalledWith([{ url: "new-york-times.com" }]);
      expect(feedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          title: createdFeeds[0].title,
        }),

        expect.anything()
      );
      expect(feedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          title: createdFeeds[1].title,
        }),
        expect.anything()
      );
    });

    it("calls the handlers for feeds with non-default refresh rates", async () => {
      const createdSchedule = await feedScheduleModel.create({
        name: "something",
        keywords: ["york"],
        refreshRateMinutes: 4,
      });
      const createdFeeds = await userFeedModel.create([
        {
          title: "feed-title",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id",
          },
          connections: sampleConnections,
        },
        {
          title: "feed-title-2",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id",
          },
          connections: sampleConnections,
        },
      ]);

      const urlsHandler = jest.fn();
      const feedHandler = jest.fn();

      await service.handleRefreshRate(createdSchedule.refreshRateMinutes * 60, {
        urlsHandler,
        feedHandler,
      });

      expect(urlsHandler).toHaveBeenCalledWith([{ url: "new-york-times.com" }]);
      expect(feedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          title: createdFeeds[0].title,
        }),
        expect.anything()
      );
      expect(feedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          title: createdFeeds[1].title,
        }),
        expect.anything()
      );
    });

    it("calls the handlers for feeds with the correct max daily articles", async () => {
      const createdSchedule = await feedScheduleModel.create({
        name: "something",
        keywords: ["york"],
        refreshRateMinutes: 4,
      });
      const createdFeeds = await userFeedModel.create([
        {
          title: "feed-title",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id",
          },
          connections: sampleConnections,
        },
        {
          title: "feed-title-2",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id-2",
          },
          connections: sampleConnections,
        },
        {
          title: "feed-title-3",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id-3",
          },
          connections: sampleConnections,
        },
      ]);

      const urlsHandler = jest.fn();
      const feedHandler = jest.fn();

      jest
        .spyOn(supportersService, "getBenefitsOfAllDiscordUsers")
        .mockResolvedValue([
          {
            discordUserId: "user-id",
            maxDailyArticles: 101,
          },
          {
            discordUserId: "user-id-2",
            maxDailyArticles: 102,
          },
        ] as never);

      await service.handleRefreshRate(createdSchedule.refreshRateMinutes * 60, {
        urlsHandler,
        feedHandler,
      });

      expect(urlsHandler).toHaveBeenCalledWith([{ url: "new-york-times.com" }]);
      expect(feedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          title: createdFeeds[0].title,
        }),
        {
          maxDailyArticles: 101,
        }
      );
      expect(feedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          title: createdFeeds[1].title,
        }),
        {
          maxDailyArticles: 102,
        }
      );
      expect(feedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          title: createdFeeds[2].title,
        }),
        {
          maxDailyArticles: supportersService.maxDailyArticlesDefault,
        }
      );
    });
  });

  describe("getUrlsMatchingRefreshRate", () => {
    it("does not return duplicate urls for default refresh rate", async () => {
      await userFeedModel.create([
        {
          title: "feed-title",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id",
          },
          connections: sampleConnections,
        },
        {
          title: "feed-title-2",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id",
          },
          connections: sampleConnections,
        },
      ]);

      const urls = await service.getUrlsMatchingRefreshRate(
        service.defaultRefreshRateSeconds
      );

      expect(urls).toEqual(["new-york-times.com"]);
    });

    it("does not return duplicate urls for non-default rates", async () => {
      const createdSchedule = await feedScheduleModel.create({
        name: "something",
        keywords: ["york"],
        refreshRateMinutes: 4,
      });
      await userFeedModel.create([
        {
          title: "feed-title",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id",
          },
          connections: sampleConnections,
        },
        {
          title: "feed-title-2",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id",
          },
          connections: sampleConnections,
        },
      ]);

      const urls = await service.getUrlsMatchingRefreshRate(
        createdSchedule.refreshRateMinutes * 60
      );

      expect(urls).toEqual(["new-york-times.com"]);
    });
  });

  describe("getFeedsQueryWithScheduleAndUsers", () => {
    it("returns nothing if no results are found", async () => {
      await userFeedModel.create([
        {
          title: "feed-title",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id",
          },
          connections: sampleConnections,
        },
        {
          title: "feed-title",
          url: "yahoo-news.com",
          user: {
            discordUserId: "user-id",
          },
          connections: sampleConnections,
        },
      ]);

      const result = await service.getFeedsQueryWithScheduleAndUsers(
        [
          {
            name: "bloomberg news",
            keywords: ["bloomberg"],
            feeds: [new Types.ObjectId().toString()],
            refreshRateMinutes: 10,
          },
        ],
        ["irrelevant-guild-id"],
        1
      );

      expect(result).toEqual([]);
    });

    it("returns nothing if no connections are found", async () => {
      await userFeedModel.create([
        {
          title: "feed-title",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id",
          },
        },
      ]);

      const result = await service.getFeedsQueryWithScheduleAndUsers(
        [
          {
            name: "bloomberg news",
            keywords: ["york"],
            feeds: [],
            refreshRateMinutes: 10,
          },
        ],
        ["irrelevant-guild-id"],
        1
      );

      expect(result).toEqual([]);
    });

    describe("schedule keywords", () => {
      it("returns matches", async () => {
        const created = await userFeedModel.create([
          {
            title: "feed-title",
            url: "new-york-times.com",
            user: {
              discordUserId: "user-id",
            },
            connections: sampleConnections,
          },
          {
            title: "feed-title",
            url: "yahoo-news.com",
            user: {
              discordUserId: "user-id",
            },
            connections: sampleConnections,
          },
        ]);

        const result = await service
          .getFeedsQueryWithScheduleAndUsers(
            [
              {
                name: "new york times",
                keywords: ["YORK"],
                feeds: [],
                refreshRateMinutes: 10,
              },
            ],
            [],
            1
          )
          .lean();

        expect(result).toHaveLength(1);
        expect(result[0].url).toEqual(created[0].url);
      });

      it("does not return if they are disabled", async () => {
        await userFeedModel.create([
          {
            title: "feed-title",
            url: "new-york-times.com",
            user: {
              discordUserId: "user-id",
            },
            disabledCode: UserFeedDisabledCode.BadFormat,
            connections: sampleConnections,
          },
        ]);

        const result = await service.getFeedsQueryWithScheduleAndUsers(
          [
            {
              name: "new york times",
              keywords: ["YORK"],
              feeds: [],
              refreshRateMinutes: 10,
            },
          ],
          [],
          1
        );

        expect(result).toEqual([]);
      });
    });

    describe("schedule feed ids", () => {
      it("returns matches", async () => {
        const created = await userFeedModel.insertMany(
          [
            {
              title: "feed-title",
              url: "new-york-times.com",
              user: {
                discordUserId: "user-id",
              },
              connections: sampleConnections,
            },
            {
              title: "feed-title",
              url: "yahoo-news.com",
              user: {
                discordUserId: "user-id",
              },
              connections: sampleConnections,
            },
          ],
          {
            ordered: true,
          }
        );

        const result = await service.getFeedsQueryWithScheduleAndUsers(
          [
            {
              name: "new york times",
              keywords: [],
              feeds: [created[1]._id],
              refreshRateMinutes: 10,
            },
          ],
          [],
          1
        );

        expect(result[0].url).toEqual(created[1].url);
      });

      it("does not return if they are disabled", async () => {
        const created = await userFeedModel.insertMany(
          [
            {
              title: "feed-title",
              url: "yahoo-news.com",
              user: {
                discordUserId: "user-id",
              },
              disabledCode: UserFeedDisabledCode.BadFormat,
              connections: sampleConnections,
            },
          ],
          {
            ordered: true,
          }
        );

        const result = await service.getFeedsQueryWithScheduleAndUsers(
          [
            {
              name: "new york times",
              keywords: [],
              feeds: [created[0]._id],
              refreshRateMinutes: 10,
            },
          ],
          [],
          1
        );

        expect(result).toEqual([]);
      });

      it("does not return if they are failed", async () => {
        const created = await userFeedModel.insertMany(
          [
            {
              title: "feed-title",
              url: "yahoo-news.com",
              user: {
                discordUserId: "user-id",
              },
              healthStatus: UserFeedHealthStatus.Failed,
              connections: sampleConnections,
            },
          ],
          {
            ordered: true,
          }
        );

        const result = await service.getFeedsQueryWithScheduleAndUsers(
          [
            {
              name: "new york times",
              keywords: [],
              feeds: [created[0]._id],
              refreshRateMinutes: 10,
            },
          ],
          [],
          1
        );

        expect(result).toEqual([]);
      });
    });

    describe("user ids", () => {
      it("returns matches", async () => {
        const created = await userFeedModel.create([
          {
            title: "feed-title",
            url: "new-york-times.com",
            user: {
              discordUserId: "user-id-1",
            },
            connections: sampleConnections,
          },
          {
            title: "feed-title",
            url: "yahoo-news.com",
            user: {
              discordUserId: "user-id-2",
            },
            connections: sampleConnections,
          },
        ]);

        const result = await service.getFeedsQueryWithScheduleAndUsers(
          [
            {
              name: "new york times",
              keywords: [],
              feeds: [],
              refreshRateMinutes: 10,
            },
          ],
          [created[1].user.discordUserId],
          1
        );

        expect(result[0].url).toEqual(created[1].url);
      });

      it("does not return if they are disabled", async () => {
        const created = await userFeedModel.create([
          {
            title: "feed-title",
            url: "new-york-times.com",
            user: {
              discordUserId: "user-id-1",
            },
            connections: sampleConnections,
          },
          {
            title: "feed-title",
            url: "yahoo-news.com",
            user: {
              discordUserId: "user-id-2",
            },
            disabledCode: UserFeedDisabledCode.BadFormat,
            connections: sampleConnections,
          },
        ]);

        const result = await service.getFeedsQueryWithScheduleAndUsers(
          [
            {
              name: "new york times",
              keywords: [],
              feeds: [],
              refreshRateMinutes: 10,
            },
          ],
          [created[1].user.discordUserId],
          1
        );

        expect(result).toEqual([]);
      });

      it("does not return if they are failed", async () => {
        const created = await userFeedModel.create([
          {
            title: "feed-title",
            url: "yahoo-news.com",
            user: {
              discordUserId: "user-id-1",
            },
            healthStatus: UserFeedHealthStatus.Failed,
            connections: sampleConnections,
          },
        ]);

        const result = await service.getFeedsQueryWithScheduleAndUsers(
          [
            {
              name: "new york times",
              keywords: [],
              feeds: [],
              refreshRateMinutes: 10,
            },
          ],
          [created[0].user.discordUserId],
          1
        );

        expect(result).toEqual([]);
      });
    });
  });

  describe("getScheduleFeedQueryExcluding", () => {
    it("returns correctly if no results are found", async () => {
      const created = await userFeedModel.create([
        {
          title: "feed-title",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id-1",
          },
          connections: sampleConnections,
        },
        {
          title: "feed-title",
          url: "yahoo-news.com",
          user: {
            discordUserId: "user-id-2",
          },
          connections: sampleConnections,
        },
      ]);

      const result = await service.getScheduleFeedQueryExcluding(
        [
          {
            name: "bloomberg news",
            keywords: ["bloomberg"],
            feeds: [new Types.ObjectId().toString()],
            refreshRateMinutes: 10,
          },
        ],
        ["irrelevant-user-id-to-exclude"],
        1
      );

      const resultUrls = result.map((feed) => feed.url);

      expect(resultUrls).toHaveLength(2);
      expect(resultUrls).toEqual(
        expect.arrayContaining([created[0].url, created[1].url])
      );
    });

    it("returns nothing if no connections are found", async () => {
      await userFeedModel.create([
        {
          title: "feed-title",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id-1",
          },
        },
      ]);

      const result = await service.getScheduleFeedQueryExcluding(
        [
          {
            name: "bloomberg news",
            keywords: ["bloomberg"],
            feeds: [],
            refreshRateMinutes: 10,
          },
        ],
        ["irrelevant-user-id-to-exclude"],
        1
      );

      const resultUrls = result.map((feed) => feed.url);

      expect(resultUrls).toHaveLength(0);
    });

    it("returns nothing if all connections are disabled", async () => {
      await userFeedModel.create([
        {
          title: "feed-title",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id-1",
          },
          connections: {
            ...sampleConnections,
            discordChannels: [
              {
                ...sampleConnections.discordChannels[0],
                disabledCode: FeedConnectionDisabledCode.MissingMedium,
              },
            ],
          },
        },
      ]);

      const result = await service.getScheduleFeedQueryExcluding(
        [
          {
            name: "bloomberg news",
            keywords: ["bloomberg"],
            feeds: [],
            refreshRateMinutes: 10,
          },
        ],
        ["irrelevant-user-id-to-exclude"],
        1
      );

      expect(result).toHaveLength(0);
    });

    it("returns correctly if some connections are enabled", async () => {
      await userFeedModel.create([
        {
          title: "feed-title",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id-1",
          },
          connections: {
            ...sampleConnections,
            discordChannels: [
              {
                ...sampleConnections.discordChannels[0],
              },
              {
                ...sampleConnections.discordChannels[0],
                id: new Types.ObjectId(),
                disabledCode: FeedConnectionDisabledCode.MissingMedium,
              },
            ],
          },
        },
      ]);

      const result = await service.getScheduleFeedQueryExcluding(
        [
          {
            name: "bloomberg news",
            keywords: ["bloomberg"],
            feeds: [],
            refreshRateMinutes: 10,
          },
        ],
        ["irrelevant-user-id-to-exclude"],
        1
      );

      expect(result).toHaveLength(1);
    });

    describe("schedule keywords", () => {
      it("returns the correct matches", async () => {
        const created = await userFeedModel.create([
          {
            title: "feed-title",
            url: "new-york-times.com",
            user: {
              discordUserId: "user-id-1",
            },
            connections: sampleConnections,
          },
          {
            title: "feed-title",
            url: "yahoo-news.com",
            user: {
              discordUserId: "user-id-1",
            },
            connections: sampleConnections,
          },
        ]);

        const result = await service.getScheduleFeedQueryExcluding(
          [
            {
              name: "new york times",
              keywords: ["YORK"],
              feeds: [],
              refreshRateMinutes: 10,
            },
          ],
          [],
          1
        );

        expect(result).toHaveLength(1);
        expect(result[0].url).toEqual(created[1].url);
      });

      it("does not return feeds that are not healthy", async () => {
        await userFeedModel.create([
          {
            title: "feed-title",
            url: "yahoo-news.com",
            user: {
              discordUserId: "user-id-1",
            },
            healthStatus: UserFeedHealthStatus.Failed,
            connections: sampleConnections,
          },
        ]);

        const result = await service.getScheduleFeedQueryExcluding(
          [
            {
              name: "new york times",
              keywords: ["yahoo"],
              feeds: [],
              refreshRateMinutes: 10,
            },
          ],
          [],
          1
        );

        expect(result).toEqual([]);
      });

      it("does not return if they are disabled", async () => {
        await userFeedModel.create([
          {
            title: "feed-title",
            url: "new-york-times.com",
            user: {
              discordUserId: "discord-user",
            },
            connections: sampleConnections,
          },
          {
            title: "feed-title",
            url: "yahoo-news.com",
            user: {
              discordUserId: "discord-user",
            },
            disabledCode: UserFeedDisabledCode.BadFormat,
            connections: sampleConnections,
          },
        ]);

        const result = await service.getScheduleFeedQueryExcluding(
          [
            {
              name: "new york times",
              keywords: ["YORK"],
              feeds: [],
              refreshRateMinutes: 10,
            },
          ],
          [],
          1
        );

        expect(result).toEqual([]);
      });
    });

    describe("schedule feed ids", () => {
      it("returns correctly based on feed id", async () => {
        const created = await userFeedModel.insertMany(
          [
            {
              title: "feed-title",
              url: "new-york-times.com",
              user: {
                discordUserId: "user-id-1",
              },
              connections: sampleConnections,
            },
            {
              title: "feed-title",
              url: "yahoo-news.com",
              user: {
                discordUserId: "user-id-1",
              },
              connections: sampleConnections,
            },
          ],
          {
            ordered: true,
          }
        );

        const result = await service.getScheduleFeedQueryExcluding(
          [
            {
              name: "new york times",
              keywords: [],
              feeds: [created[1]._id],
              refreshRateMinutes: 10,
            },
          ],
          [],
          1
        );

        expect(result[0].url).toEqual(created[0].url);
      });

      it("does not return if they are disabled", async () => {
        const created = await userFeedModel.insertMany(
          [
            {
              title: "feed-title",
              url: "new-york-times.com",
              user: {
                discordUserId: "user-id-1",
              },
              connections: sampleConnections,
            },
            {
              title: "feed-title",
              url: "yahoo-news.com",
              user: {
                discordUserId: "user-id-1",
              },
              disabledCode: UserFeedDisabledCode.BadFormat,
              connections: sampleConnections,
            },
          ],
          {
            ordered: true,
          }
        );

        const result = await service.getScheduleFeedQueryExcluding(
          [
            {
              name: "new york times",
              keywords: [],
              feeds: [created[0]._id],
              refreshRateMinutes: 10,
            },
          ],
          [],
          1
        );

        expect(result).toHaveLength(0);
      });
    });

    describe("user ids", () => {
      it("returns correctly", async () => {
        const created = await userFeedModel.create([
          {
            title: "feed-title",
            url: "new-york-times.com",
            user: {
              discordUserId: "user-id-1",
            },
            connections: sampleConnections,
          },
          {
            title: "feed-title",
            url: "yahoo-news.com",
            user: {
              discordUserId: "user-id-2",
            },
            connections: sampleConnections,
          },
        ]);

        const result = await service.getScheduleFeedQueryExcluding(
          [
            {
              name: "new york times",
              keywords: [],
              feeds: [],
              refreshRateMinutes: 10,
            },
          ],
          [created[1].user.discordUserId],
          1
        );

        expect(result).toHaveLength(1);
        expect(result[0].url).toEqual(created[0].url);
      });

      it("does not return if they are disabled", async () => {
        const created = await userFeedModel.create([
          {
            title: "feed-title",
            url: "new-york-times.com",
            user: {
              discordUserId: "user-id-1",
            },
            disabledCode: UserFeedDisabledCode.BadFormat,
            connections: sampleConnections,
          },
          {
            title: "feed-title",
            url: "yahoo-news.com",
            user: {
              discordUserId: "user-id-2",
            },
            connections: sampleConnections,
          },
        ]);

        const result = await service.getScheduleFeedQueryExcluding(
          [
            {
              name: "new york times",
              keywords: [],
              feeds: [],
              refreshRateMinutes: 10,
            },
          ],
          [created[1].user.discordUserId],
          1
        );

        expect(result).toHaveLength(0);
      });
    });
  });

  describe("handleUrlRequestFailureEvent", () => {
    it("disables feeds", async () => {
      const feed = await userFeedModel.create({
        title: "feed-title",
        url: "new-york-times.com",
        user: {
          discordUserId: "user-id-1",
        },
        connections: sampleConnections,
      });

      await service.handleUrlRequestFailureEvent({
        data: {
          url: feed.url,
        },
      });

      const updatedFeed = await userFeedModel.findById(feed._id);

      expect(updatedFeed?.disabledCode).toEqual(
        UserFeedDisabledCode.FailedRequests
      );
      expect(updatedFeed?.healthStatus).toEqual(UserFeedHealthStatus.Failed);
    });

    it("does not override an existing disabled code", async () => {
      const feed = await userFeedModel.create({
        title: "feed-title",
        url: "new-york-times.com",
        user: {
          discordUserId: "user-id-1",
        },
        connections: sampleConnections,
        disabledCode: UserFeedDisabledCode.ExceededFeedLimit,
      });

      await service.handleUrlRequestFailureEvent({
        data: {
          url: feed.url,
        },
      });

      const updatedFeed = await userFeedModel.findById(feed._id).lean();

      expect(updatedFeed?.disabledCode).toEqual(
        UserFeedDisabledCode.ExceededFeedLimit
      );
      expect(updatedFeed?.healthStatus).toEqual(UserFeedHealthStatus.Ok);
    });
  });

  describe("handleRejectedArticleDisableConnection", () => {
    it.each([
      {
        articleRejectCode: ArticleRejectCode.BadRequest,
        connectionDisableCode: FeedConnectionDisabledCode.BadFormat,
      },
      {
        articleRejectCode: ArticleRejectCode.Forbidden,
        connectionDisableCode: FeedConnectionDisabledCode.MissingPermissions,
      },
      {
        articleRejectCode: ArticleRejectCode.MediumNotFound,
        connectionDisableCode: FeedConnectionDisabledCode.MissingMedium,
      },
    ])(
      "disables the connection with article reject code $articleRejectCode",
      async ({ articleRejectCode, connectionDisableCode }) => {
        const connectionId = new Types.ObjectId();
        const feed = await userFeedModel.create({
          title: "feed-title",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id-1",
          },
          connections: {
            discordChannels: [
              {
                id: connectionId,
                name: "connection-name",
                filters: {
                  expression: {
                    foo: "bar",
                  },
                },
                details: {
                  channel: {
                    id: "channel-id",
                    guildId: "guild-id",
                  },
                },
              },
            ],
          },
        });

        const payload = {
          data: {
            rejectedCode: articleRejectCode,
            medium: {
              id: connectionId.toHexString(),
            },
            feed: {
              id: feed._id.toHexString(),
            },
          },
        };

        await service.handleRejectedArticleDisableConnection(payload);

        const foundUserFeed = await userFeedModel.findById(feed._id).lean();

        expect(
          foundUserFeed?.connections.discordChannels[0].disabledCode
        ).toEqual(connectionDisableCode);
      }
    );

    it("does not override an existing disabled code", async () => {
      const connectionId = new Types.ObjectId();
      const feed = await userFeedModel.create({
        title: "feed-title",
        url: "new-york-times.com",
        user: {
          discordUserId: "user-id-1",
        },
        connections: {
          discordChannels: [
            {
              disabledCode: FeedConnectionDisabledCode.Manual,
              id: connectionId,
              name: "connection-name",
              filters: {
                expression: {
                  foo: "bar",
                },
              },
              details: {
                channel: {
                  id: "channel-id",
                  guildId: "guild-id",
                },
              },
            },
          ],
        },
      });

      const payload = {
        data: {
          rejectedCode: ArticleRejectCode.MediumNotFound,
          medium: {
            id: connectionId.toHexString(),
          },
          feed: {
            id: feed._id.toHexString(),
          },
        },
      };

      await service.handleRejectedArticleDisableConnection(payload);

      const foundUserFeed = await userFeedModel.findById(feed._id).lean();

      expect(
        foundUserFeed?.connections.discordChannels[0].disabledCode
      ).toEqual(FeedConnectionDisabledCode.Manual);
    });
  });

  describe("emitDeliverFeedArticlesEvent", () => {
    it("emits the correct event for discord channel mediums", async () => {
      const feed = await userFeedModel.create({
        title: "feed-title",
        url: "new-york-times.com",
        user: {
          discordUserId: "user-id-1",
        },
        formatOptions: {
          dateFormat: "MMMM Do YYYY, h:mm:ss a",
        },
        connections: {
          discordChannels: [
            {
              id: new Types.ObjectId(),
              filters: {
                expression: {
                  foo: "bar",
                },
              },
              splitOptions: {
                splitChar: "a",
                appendChar: "append",
                prependChar: "prepend",
                isEnabled: true,
              },
              details: {
                formatter: {
                  formatTables: true,
                  stripImages: true,
                },
                channel: {
                  id: "channel-id",
                  guildId: "guild-id",
                },
                content: "content",
                embeds: [
                  {
                    title: "embed-title",
                    description: "embed-description",
                    url: "embed-url",
                    color: "123",
                    fields: [
                      {
                        name: "field-name",
                        value: "field-value",
                        inline: true,
                      },
                    ],
                    footerText: "footer-text",
                    footerIconURL: "footer-icon-url",
                    thumbnailURL: "thumbnail-url",
                    imageURL: "image-url",
                  },
                ],
              },
              name: "connection-name",
            },
          ],
        },
      });

      const foundLean = await userFeedModel.findById(feed._id).lean();

      await service.emitDeliverFeedArticlesEvent({
        userFeed: foundLean as UserFeed,
        maxDailyArticles: 100,
      });

      const args = amqpConnection.publish.mock.calls[0];

      expect(args[0]).toEqual("");
      expect(args[1]).toEqual("feed.deliver-articles");
      expect(args[2]).toMatchObject({
        data: {
          articleDayLimit: 100,
          feed: {
            id: feed._id.toHexString(),
            url: feed.url,
            passingComparisons: [],
            blockingComparisons: [],
            formatOptions: {
              dateFormat: "MMMM Do YYYY, h:mm:ss a",
            },
          },
          mediums: [
            {
              id: feed.connections.discordChannels[0].id.toHexString(),
              key: "discord",
              filters: {
                expression: {
                  foo: "bar",
                },
              },
              details: {
                channel: {
                  id: "channel-id",
                },
                content: "content",
                guildId: "guild-id",
                embeds: [
                  {
                    title: "embed-title",
                    description: "embed-description",
                    url: "embed-url",
                    color: 123,
                    fields: [
                      {
                        name: "field-name",
                        value: "field-value",
                        inline: true,
                      },
                    ],
                    footer: {
                      text: "footer-text",
                      iconUrl: "footer-icon-url",
                    },
                    thumbnail: {
                      url: "thumbnail-url",
                    },
                    image: {
                      url: "image-url",
                    },
                  },
                ],
                formatter: {
                  formatTables: true,
                  stripImages: true,
                },
                splitOptions: {
                  splitChar: "a",
                  appendChar: "append",
                  prependChar: "prepend",
                },
              },
            },
          ],
        },
      });
      expect(args[3]).toMatchObject({
        expiration: 3600000,
      });
    });

    it("emits the correct event for discord webhook mediums", async () => {
      const feed = await userFeedModel.create({
        title: "feed-title",
        url: "new-york-times.com",
        user: {
          discordUserId: "user-id-1",
        },
        formatOptions: {
          dateFormat: "MMMM Do YYYY, h:mm:ss a",
        },
        connections: {
          discordWebhooks: [
            {
              id: new Types.ObjectId(),
              name: "webhook-connection-name",
              filters: {
                expression: {
                  foo: "bar",
                },
              },
              splitOptions: {
                splitChar: "a",
                appendChar: "append",
                prependChar: "prepend",
                isEnabled: true,
              },
              details: {
                formatter: {
                  formatTables: true,
                  stripImages: true,
                },
                webhook: {
                  id: "webhook-id",
                  token: "webhook token",
                  guildId: "guild-id",
                  iconUrl: "icon-url",
                  name: "webhook-name",
                },
                content: "content",
                embeds: [
                  {
                    title: "embed-title",
                    description: "embed-description",
                    url: "embed-url",
                    color: "123",
                    fields: [
                      {
                        name: "field-name",
                        value: "field-value",
                        inline: true,
                      },
                    ],
                    footerText: "footer-text",
                    footerIconURL: "footer-icon-url",
                    thumbnailURL: "thumbnail-url",
                    imageURL: "image-url",
                  },
                ],
              },
            },
          ],
        },
      });

      const foundLean = await userFeedModel.findById(feed._id).lean();

      await service.emitDeliverFeedArticlesEvent({
        userFeed: foundLean as UserFeed,
        maxDailyArticles: 102,
      });

      const args = amqpConnection.publish.mock.calls[0];

      expect(args[0]).toEqual("");
      expect(args[1]).toEqual("feed.deliver-articles");
      expect(args[2]).toMatchObject({
        data: {
          articleDayLimit: 102,
          feed: {
            id: feed._id.toHexString(),
            url: feed.url,
            passingComparisons: [],
            blockingComparisons: [],
            formatOptions: {
              dateFormat: "MMMM Do YYYY, h:mm:ss a",
            },
          },
          mediums: [
            {
              id: feed.connections.discordWebhooks[0].id.toHexString(),
              key: "discord",
              filters: {
                expression: {
                  foo: "bar",
                },
              },
              details: {
                webhook: {
                  id: "webhook-id",
                  token: "webhook token",
                  name: "webhook-name",
                  iconUrl: "icon-url",
                },
                content: "content",
                guildId: "guild-id",
                embeds: [
                  {
                    title: "embed-title",
                    description: "embed-description",
                    url: "embed-url",
                    color: 123,
                    fields: [
                      {
                        name: "field-name",
                        value: "field-value",
                        inline: true,
                      },
                    ],
                    footer: {
                      text: "footer-text",
                      iconUrl: "footer-icon-url",
                    },
                    thumbnail: {
                      url: "thumbnail-url",
                    },
                    image: {
                      url: "image-url",
                    },
                  },
                ],
                formatter: {
                  formatTables: true,
                  stripImages: true,
                },
                splitOptions: {
                  splitChar: "a",
                  appendChar: "append",
                  prependChar: "prepend",
                },
              },
            },
          ],
        },
      });
      expect(args[3]).toMatchObject({
        expiration: 3600000,
      });
    });
  });
});

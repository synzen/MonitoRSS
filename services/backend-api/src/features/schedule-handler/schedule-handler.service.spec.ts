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
  UserFeed,
  UserFeedFeature,
  UserFeedModel,
} from "../user-feeds/entities";

import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { SupportersService } from "../supporters/supporters.service";
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
          refreshRateSeconds: service.defaultRefreshRateSeconds,
        },
        {
          title: "feed-title-2",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id",
          },
          connections: sampleConnections,
          refreshRateSeconds: service.defaultRefreshRateSeconds,
        },
      ]);

      const urlsHandler = jest.fn();

      await service.handleRefreshRate(service.defaultRefreshRateSeconds, {
        urlsHandler,
      });

      expect(urlsHandler).toHaveBeenCalledWith([{ url: "new-york-times.com" }]);
    });

    it("calls the handlers in batches for feeds with default refresh rate", async () => {
      const generatedEntities = new Array(27).fill(0).map((_, index) => ({
        title: index + " feed-title",
        url: index + "new-york-times.com",
        user: {
          discordUserId: "user-id",
        },
        connections: sampleConnections,
        refreshRateSeconds: service.defaultRefreshRateSeconds,
      }));
      await userFeedModel.insertMany(generatedEntities);

      const urlsHandler = jest.fn();

      await service.handleRefreshRate(service.defaultRefreshRateSeconds, {
        urlsHandler,
      });

      expect(urlsHandler).toHaveBeenCalledTimes(2);
      const firstCallArg = urlsHandler.mock.calls[0][0];
      const secondCallArg = urlsHandler.mock.calls[1][0];

      expect(firstCallArg).toHaveLength(25);
      expect(secondCallArg).toHaveLength(2);
    });
  });

  describe("getUrlsQueryMatchingRefreshRate", () => {
    it("does not return duplicate urls for default refresh rate", async () => {
      await userFeedModel.create([
        {
          title: "feed-title",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id",
          },
          connections: sampleConnections,
          refreshRateSeconds: service.defaultRefreshRateSeconds,
        },
        {
          title: "feed-title-2",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id",
          },
          connections: sampleConnections,
          refreshRateSeconds: service.defaultRefreshRateSeconds,
        },
      ]);

      const urls = await service.getUrlsQueryMatchingRefreshRate(
        service.defaultRefreshRateSeconds
      );

      expect(urls).toEqual([{ _id: "new-york-times.com" }]);
    });

    it("works with alternate refresh rate", async () => {
      await userFeedModel.create([
        {
          title: "feed-title",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id",
          },
          connections: sampleConnections,
          refreshRateSeconds: 30,
        },
        {
          title: "feed-title-2",
          url: "new-york-times-2.com",
          user: {
            discordUserId: "user-id",
          },
          connections: sampleConnections,
          refreshRateSeconds: service.defaultRefreshRateSeconds,
        },
      ]);

      const urls = await service.getUrlsQueryMatchingRefreshRate(30);

      expect(urls).toEqual([{ _id: "new-york-times.com" }]);
    });

    it("does not return feeds with feed request lookup keys", async () => {
      await userFeedModel.create([
        {
          title: "feed-title",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id",
          },
          connections: sampleConnections,
          refreshRateSeconds: 30,
          feedRequestLookupKey: "1",
        },
        {
          title: "feed-title-2",
          url: "new-york-times-2.com",
          user: {
            discordUserId: "user-id",
          },
          connections: sampleConnections,
          refreshRateSeconds: service.defaultRefreshRateSeconds,
          feedRequestLookupKey: "2",
        },
      ]);

      const urls = await service.getUrlsQueryMatchingRefreshRate(30);

      expect(urls).toEqual([]);
    });
  });

  describe("getUnbatchedUrlsQueryMatchingRefreshRate", () => {
    it("returns the correct query", async () => {
      await userFeedModel.create([
        {
          title: "feed-title",
          url: "new-york-times.com",
          user: {
            discordUserId: "user-id",
          },
          connections: sampleConnections,
          refreshRateSeconds: 30,
          feedRequestLookupKey: "1",
        },
        {
          title: "feed-title-2",
          url: "new-york-times-2.com",
          user: {
            discordUserId: "user-id",
          },
          connections: sampleConnections,
          refreshRateSeconds: 30,
          feedRequestLookupKey: "2",
        },
      ]);

      const urls = await service.getUnbatchedUrlsQueryMatchingRefreshRate(30);

      expect(urls).toMatchObject([
        {
          url: "new-york-times.com",
          feedRequestLookupKey: "1",
        },
        {
          url: "new-york-times-2.com",
          feedRequestLookupKey: "2",
        },
      ]);
    });
  });
});

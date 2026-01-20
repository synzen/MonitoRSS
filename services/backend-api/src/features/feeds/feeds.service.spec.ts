import { getModelToken, MongooseModule } from "@nestjs/mongoose";
import { createTestFeed } from "../../test/data/feeds.test-data";
import {
  setupIntegrationTests,
  teardownIntegrationTests,
} from "../../utils/integration-tests";
import { MongooseTestModule } from "../../utils/mongoose-test.module";
import { Feed, FeedFeature, FeedModel } from "./entities/feed.entity";
import { FeedsService } from "./feeds.service";
import {
  FailRecord,
  FailRecordFeature,
  FailRecordModel,
} from "./entities/fail-record.entity";
import { FeedSchedulingService } from "./feed-scheduling.service";
import { FeedScheduleFeature } from "./entities/feed-schedule.entity";
import { ConfigService } from "@nestjs/config";
import { DiscordAPIService } from "../../services/apis/discord/discord-api.service";
import {
  FeedSubscriber,
  FeedSubscriberFeature,
  FeedSubscriberModel,
} from "./entities/feed-subscriber.entity";
import { FeedFetcherService } from "../../services/feed-fetcher/feed-fetcher.service";
import { DiscordAuthService } from "../discord-auth/discord-auth.service";

import { SupportersService } from "../supporters/supporters.service";
import {
  BannedFeed,
  BannedFeedFeature,
  BannedFeedModel,
} from "./entities/banned-feed.entity";
import { DiscordPermissionsService } from "../discord-auth/discord-permissions.service";
import { FeedFilteredFormatFeature } from "./entities/feed-filtered-format.entity";

jest.mock("../../utils/logger");

describe("FeedsService", () => {
  let service: FeedsService;
  let feedModel: FeedModel;
  let failRecordModel: FailRecordModel;
  let feedSubscriberModel: FeedSubscriberModel;
  let bannedFeedModel: BannedFeedModel;
  const feedSchedulingService: FeedSchedulingService = {
    getRefreshRatesOfFeeds: jest.fn(),
  } as never;

  beforeAll(async () => {
    const { uncompiledModule, init } = await setupIntegrationTests({
      providers: [
        FeedsService,
        FeedSchedulingService,
        ConfigService,
        DiscordAPIService,
        FeedFetcherService,
        DiscordAuthService,
        SupportersService,
        DiscordPermissionsService,
      ],
      imports: [
        MongooseTestModule.forRoot(),
        MongooseModule.forFeature([
          FeedFeature,
          FailRecordFeature,
          FeedScheduleFeature,
          FeedSubscriberFeature,
          BannedFeedFeature,
          FeedFilteredFormatFeature,
        ]),
      ],
    });

    uncompiledModule
      .overrideProvider(FeedSchedulingService)
      .useValue(feedSchedulingService)
      .overrideProvider(ConfigService)
      .useValue({
        get: jest.fn(),
      })
      .overrideProvider(DiscordAPIService)
      .useValue({ executeBotRequest: jest.fn(), getChannel: jest.fn() })
      .overrideProvider(FeedFetcherService)
      .useValue({
        fetchFeed: jest.fn(),
      })
      .overrideProvider(DiscordAuthService)
      .useValue({
        userManagesGuild: jest.fn(),
      })
      .overrideProvider(SupportersService)
      .useValue({
        getBenefitsOfServers: jest.fn(),
      })
      .overrideProvider(DiscordPermissionsService)
      .useValue({
        botHasPermissionInChannel: jest.fn(),
      });

    const { module } = await init();

    service = module.get<FeedsService>(FeedsService);
    feedModel = module.get<FeedModel>(getModelToken(Feed.name));
    failRecordModel = module.get<FailRecordModel>(
      getModelToken(FailRecord.name)
    );
    feedSubscriberModel = module.get<FeedSubscriberModel>(
      getModelToken(FeedSubscriber.name)
    );
    bannedFeedModel = module.get<BannedFeedModel>(
      getModelToken(BannedFeed.name)
    );
  });

  beforeEach(() => {
    jest.resetAllMocks();
    jest
      .spyOn(feedSchedulingService, "getRefreshRatesOfFeeds")
      .mockResolvedValue(new Array(500).fill(15));
  });

  afterEach(async () => {
    await feedModel.deleteMany({});
    await failRecordModel.deleteMany({});
    await feedSubscriberModel.deleteMany({});
    await bannedFeedModel.deleteMany({});
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getServerFeeds", () => {
    it("returns the sorted feeds, respecting limit and offset", async () => {
      const guild = "server-1";
      const feedsToInsert = await Promise.all([
        createTestFeed({
          addedAt: new Date(2020),
          title: "2020",
          guild,
        }),
        createTestFeed({
          addedAt: new Date(2019),
          title: "2019",
          guild,
        }),
        createTestFeed({
          addedAt: new Date(2022),
          title: "2022",
          guild,
        }),
        createTestFeed({
          addedAt: new Date(2021),
          title: "2021",
          guild,
        }),
      ]);

      await feedModel.insertMany(feedsToInsert);

      const found = await service.getServerFeeds(guild, {
        limit: 2,
        offset: 1,
      });

      const foundTitles = found.map((feed) => feed.title);

      expect(foundTitles).toEqual(["2021", "2020"]);
    });
  });

  describe("countServerFeeds", () => {
    it("returns the correct count", async () => {
      const guild = "server-1";
      const feedsToInsert = await Promise.all([
        createTestFeed({
          title: "2020",
          guild,
        }),
        createTestFeed({
          title: "2019",
          guild,
        }),
      ]);

      await feedModel.insertMany(feedsToInsert);

      const count = await service.countServerFeeds(guild);

      expect(count).toEqual(2);
    });

    it("works with search", async () => {
      const guild = "server-1";
      const feedsToInsert = await Promise.all([
        createTestFeed({
          title: "google",
          guild,
        }),
        createTestFeed({
          title: "yahoo",
          guild,
        }),
        createTestFeed({
          url: "google.com",
          guild,
        }),
        createTestFeed({
          title: "bing",
          guild,
        }),
      ]);

      await feedModel.insertMany(feedsToInsert);

      const count = await service.countServerFeeds(guild, {
        search: "goo",
      });

      expect(count).toEqual(2);
    });
  });

  describe("isBannedFeed", () => {
    it("does not return a record for a guild that does not apply", async () => {
      const url = "https://www.reddit.com/r/";
      await bannedFeedModel.create({
        url: url,
        guildIds: ["123"],
      });
      const record = await service.getBannedFeedDetails(url, "456");
      expect(record).toBeNull();
    });

    it("does not return a record if the url does not match", async () => {
      const url = "a";
      const guildId = "guild-id";
      await bannedFeedModel.create({
        url: "b",
        guildIds: [],
      });
      const record = await service.getBannedFeedDetails(url, guildId);
      expect(record).toBeNull();
    });

    it("returns the record for exact matches", async () => {
      const url = "https://www.reddit.com/r/";
      const guildId = "guild-id";
      await bannedFeedModel.create({
        url: url,
        guildIds: [guildId],
      });
      const record = await service.getBannedFeedDetails(url, guildId);
      expect(record).not.toBeNull();
    });
  });
});

import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";
import { FeedSchedulingService } from "../../src/services/feed-scheduling/feed-scheduling.service";
import type { Config } from "../../src/config";
import type { IFeedScheduleRepository } from "../../src/repositories/interfaces/feed-schedule.types";
import type { SupportersService } from "../../src/services/supporters/supporters.service";

describe("FeedSchedulingService", { concurrency: false }, () => {
  const defaultRefreshRateMinutes = 10;
  const mockConfig = {
    BACKEND_API_DEFAULT_REFRESH_RATE_MINUTES: defaultRefreshRateMinutes,
  } as Config;

  describe("getRefreshRatesOfFeeds", () => {
    const sampleFeedDetails = [
      {
        id: "1",
        url: "https://example.com",
        guild: "guild-1",
      },
    ];

    it("returns the default refresh rate if server benefits failed to calculate", async () => {
      const mockFeedScheduleRepository: IFeedScheduleRepository = {
        findAllExcludingDefault: async () => [],
      };

      const mockSupportersService = {
        getBenefitsOfServers: async () => [],
      } as unknown as SupportersService;

      const service = new FeedSchedulingService({
        config: mockConfig,
        supportersService: mockSupportersService,
        feedScheduleRepository: mockFeedScheduleRepository,
      });

      const result = await service.getRefreshRatesOfFeeds(sampleFeedDetails);

      assert.deepStrictEqual(result, [service.defaultRefreshRateSeconds]);
    });

    it("returns the refresh rates of the benefits when feeds are backed by supporter", async () => {
      const serverBenefits = [
        {
          serverId: sampleFeedDetails[0].guild,
          hasSupporter: true,
          refreshRateSeconds: 100,
        },
      ];

      const mockFeedScheduleRepository: IFeedScheduleRepository = {
        findAllExcludingDefault: async () => [],
      };

      const mockSupportersService = {
        getBenefitsOfServers: async () => serverBenefits,
      } as unknown as SupportersService;

      const service = new FeedSchedulingService({
        config: mockConfig,
        supportersService: mockSupportersService,
        feedScheduleRepository: mockFeedScheduleRepository,
      });

      const refreshRates = await service.getRefreshRatesOfFeeds(sampleFeedDetails);

      assert.strictEqual(refreshRates[0], serverBenefits[0].refreshRateSeconds);
    });

    it("returns the default refresh rate if no schedule matches for non-supporters", async () => {
      const mockFeedScheduleRepository: IFeedScheduleRepository = {
        findAllExcludingDefault: async () => [],
      };

      const mockSupportersService = {
        getBenefitsOfServers: async () => [
          {
            hasSupporter: false,
            serverId: sampleFeedDetails[0].guild,
          },
        ],
      } as unknown as SupportersService;

      const service = new FeedSchedulingService({
        config: mockConfig,
        supportersService: mockSupportersService,
        feedScheduleRepository: mockFeedScheduleRepository,
      });

      const refreshRates = await service.getRefreshRatesOfFeeds(sampleFeedDetails);

      assert.strictEqual(refreshRates[0], service.defaultRefreshRateSeconds);
    });

    it("returns the refresh rate of the schedule that matches the keywords", async () => {
      const mockSchedules = [
        {
          id: "schedule-1",
          name: "test-schedule",
          keywords: [sampleFeedDetails[0].url],
          feeds: [],
          refreshRateMinutes: 1,
        },
      ];

      const mockFeedScheduleRepository: IFeedScheduleRepository = {
        findAllExcludingDefault: async () => mockSchedules,
      };

      const mockSupportersService = {
        getBenefitsOfServers: async () => [
          {
            hasSupporter: false,
            serverId: sampleFeedDetails[0].guild,
          },
        ],
      } as unknown as SupportersService;

      const service = new FeedSchedulingService({
        config: mockConfig,
        supportersService: mockSupportersService,
        feedScheduleRepository: mockFeedScheduleRepository,
      });

      const refreshRates = await service.getRefreshRatesOfFeeds(sampleFeedDetails);

      assert.strictEqual(refreshRates[0], mockSchedules[0].refreshRateMinutes * 60);
    });

    it("returns the refresh rate of the schedule that matches the feed id", async () => {
      const mockSchedules = [
        {
          id: "schedule-1",
          name: "test-schedule",
          keywords: [],
          feeds: [sampleFeedDetails[0].id],
          refreshRateMinutes: 1,
        },
      ];

      const mockFeedScheduleRepository: IFeedScheduleRepository = {
        findAllExcludingDefault: async () => mockSchedules,
      };

      const mockSupportersService = {
        getBenefitsOfServers: async () => [
          {
            hasSupporter: false,
            serverId: sampleFeedDetails[0].guild,
          },
        ],
      } as unknown as SupportersService;

      const service = new FeedSchedulingService({
        config: mockConfig,
        supportersService: mockSupportersService,
        feedScheduleRepository: mockFeedScheduleRepository,
      });

      const refreshRates = await service.getRefreshRatesOfFeeds(sampleFeedDetails);

      assert.strictEqual(refreshRates[0], mockSchedules[0].refreshRateMinutes * 60);
    });

    it("returns the default refresh rate if no schedules match keywords or feeds", async () => {
      const mockSchedules = [
        {
          id: "schedule-1",
          name: "test-schedule",
          keywords: ["not-a-match-for-anything"],
          feeds: [],
          refreshRateMinutes: 1,
        },
      ];

      const mockFeedScheduleRepository: IFeedScheduleRepository = {
        findAllExcludingDefault: async () => mockSchedules,
      };

      const mockSupportersService = {
        getBenefitsOfServers: async () => [
          {
            hasSupporter: false,
            serverId: sampleFeedDetails[0].guild,
          },
        ],
      } as unknown as SupportersService;

      const service = new FeedSchedulingService({
        config: mockConfig,
        supportersService: mockSupportersService,
        feedScheduleRepository: mockFeedScheduleRepository,
      });

      const refreshRates = await service.getRefreshRatesOfFeeds(sampleFeedDetails);

      assert.strictEqual(refreshRates[0], service.defaultRefreshRateSeconds);
    });
  });
});

import { FeedSchedulingService } from "./feed-scheduling.service";

describe("FeedSchedulingService", () => {
  const feedScheduleFind = jest.fn();
  const supportersService = {
    getBenefitsOfServers: jest.fn(),
  };
  const configService = {
    get: jest.fn(),
  };
  const feedScheduleModel = {
    find: jest.fn(),
  };
  let service: FeedSchedulingService;

  beforeEach(() => {
    jest.resetAllMocks();
    feedScheduleModel.find.mockReturnValue({
      lean: feedScheduleFind.mockReturnValue([]),
    });
    service = new FeedSchedulingService(
      supportersService as never,
      configService as never,
      feedScheduleModel as never
    );
    service.defaultRefreshRateSeconds = 600;
  });

  describe("getRefreshRateOfFeeds", () => {
    const sampleFeedDetails = [
      {
        _id: "1",
        url: "https://example.com",
        guild: "1",
      },
    ];

    it("returns the default refresh rate if server benefits failed to calculate", async () => {
      const consoleError = jest.spyOn(console, "error").mockImplementation();
      supportersService.getBenefitsOfServers.mockResolvedValue([]);
      const result = await service.getRefreshRatesOfFeeds(sampleFeedDetails);

      expect(result).toEqual([service.defaultRefreshRateSeconds]);
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    describe("when the feeds are backed by a supporter", () => {
      it("returns the refreh rates of the benefits", async () => {
        const serverBenefits = [
          {
            serverId: sampleFeedDetails[0].guild,
            hasSupporter: true,
            refreshRateSeconds: 100,
          },
        ];

        supportersService.getBenefitsOfServers.mockResolvedValue(
          serverBenefits
        );

        const refreshRates = await service.getRefreshRatesOfFeeds(
          sampleFeedDetails
        );
        expect(refreshRates[0]).toBe(serverBenefits[0].refreshRateSeconds);
      });
    });

    describe("when the feeds are not backed by supporters", () => {
      beforeEach(() => {
        supportersService.getBenefitsOfServers.mockResolvedValue(
          sampleFeedDetails.map(() => ({
            hasSupporter: false,
            serverId: sampleFeedDetails[0].guild,
          }))
        );
      });

      it("returns the default refresh rate if no schedule matches", async () => {
        const refreshRates = await service.getRefreshRatesOfFeeds(
          sampleFeedDetails
        );
        expect(refreshRates[0]).toBe(service.defaultRefreshRateSeconds);
      });

      it("returns the refresh rate of the schedule that matches the keywords", async () => {
        const mockScheduleFindResponse = [
          {
            keywords: [sampleFeedDetails[0].url],
            refreshRateMinutes: 1,
          },
        ];
        feedScheduleFind.mockResolvedValue(mockScheduleFindResponse);
        const refreshRates = await service.getRefreshRatesOfFeeds(
          sampleFeedDetails
        );
        expect(refreshRates[0]).toBe(
          mockScheduleFindResponse[0].refreshRateMinutes * 60
        );
      });

      it("returns the refresh rate of the schedule that matches the feed id", async () => {
        const mockScheduleFindResponse = [
          {
            feeds: [sampleFeedDetails[0]._id],
            refreshRateMinutes: 1,
          },
        ];
        feedScheduleFind.mockResolvedValue(mockScheduleFindResponse);
        const refreshRates = await service.getRefreshRatesOfFeeds(
          sampleFeedDetails
        );
        expect(refreshRates[0]).toBe(
          mockScheduleFindResponse[0].refreshRateMinutes * 60
        );
      });

      it("returns the default refresh rate if no schedules match", async () => {
        const mockScheduleFindResponse = [
          {
            keywords: ["not-a-match-for-anything"],
            refreshRateMinutes: 1,
          },
        ];
        feedScheduleFind.mockResolvedValue(mockScheduleFindResponse);
        const refreshRates = await service.getRefreshRatesOfFeeds(
          sampleFeedDetails
        );
        expect(refreshRates[0]).toBe(service.defaultRefreshRateSeconds);
      });
    });
  });
});

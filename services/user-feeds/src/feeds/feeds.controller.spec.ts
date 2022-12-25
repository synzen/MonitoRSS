import { FeedsController } from "./feeds.controller";

describe("FeedController", () => {
  const feedsService = {
    initializeFeed: jest.fn(),
    getRateLimitInformation: jest.fn(),
  };
  let controller: FeedsController;

  beforeEach(async () => {
    controller = new FeedsController(feedsService as never);
  });

  describe("initializeFeed", () => {
    it("initializes the feed", async () => {
      const feedId = "feed-id";
      const articleDailyLimit = 1;
      await controller.initializeFeed({
        feed: {
          id: feedId,
        },
        articleDailyLimit,
      });
      expect(feedsService.initializeFeed).toHaveBeenCalledWith(feedId, {
        rateLimit: {
          limit: articleDailyLimit,
          timeWindowSec: 86400,
        },
      });
    });

    it("returns all rate limits", async () => {
      const feedId = "feed-id";
      const articleDailyLimit = 1;
      const rateLimitInfo = [
        { progress: 1, max: 2, remaining: 3, windowSeconds: 4 },
      ];
      feedsService.getRateLimitInformation.mockResolvedValue(rateLimitInfo);
      const result = await controller.initializeFeed({
        feed: {
          id: feedId,
        },
        articleDailyLimit,
      });
      expect(result).toEqual({ articleRateLimits: rateLimitInfo });
    });
  });
});

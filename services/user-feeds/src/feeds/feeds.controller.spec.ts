import { BadRequestException } from "@nestjs/common";
import { DiscordMediumTestPayloadDetails } from "../shared";
import { TestDeliveryStatus } from "./constants";
import { FeedsController } from "./feeds.controller";

describe("FeedController", () => {
  const feedsService = {
    initializeFeed: jest.fn(),
    getRateLimitInformation: jest.fn(),
  };
  const discordMediumService = {
    deliverTestArticle: jest.fn(),
  };
  const feedFetcherService = {
    fetchRandomFeedArticle: jest.fn(),
    fetchFeedArticles: jest.fn(),
  };
  let controller: FeedsController;

  beforeEach(async () => {
    jest.resetAllMocks();
    controller = new FeedsController(
      feedsService as never,
      discordMediumService as never,
      feedFetcherService as never
    );
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

  describe("getFeedArticles", () => {
    it("calls fetch with the decoded url", async () => {
      const url = "https://www.google.com?query=1&query=2";
      const input = {
        limit: 1,
        random: false,
        url: encodeURIComponent(url),
      };
      await controller.getFeedArticles(input);
      expect(feedFetcherService.fetchFeedArticles).toHaveBeenCalledWith(url);
    });

    it("returns an empty array of results if request is pending", async () => {
      const input = {
        limit: 1,
        random: false,
        url: "url",
      };

      jest
        .spyOn(feedFetcherService, "fetchFeedArticles")
        .mockResolvedValue(null);

      const result = await controller.getFeedArticles(input);

      expect(result).toEqual({ results: [] });
    });

    it("returns an empty array of results if there are no articles", async () => {
      const input = {
        limit: 1,
        random: false,
        url: "url",
      };

      jest.spyOn(feedFetcherService, "fetchFeedArticles").mockResolvedValue({
        articles: [],
      });

      const result = await controller.getFeedArticles(input);

      expect(result).toEqual({ results: [] });
    });

    it("returns an array of results if request is not pending", async () => {
      const input = {
        limit: 1,
        random: false,
        url: "url",
      };

      const fetchedArticles = [
        {
          id: "1",
        },
      ];

      jest.spyOn(feedFetcherService, "fetchFeedArticles").mockResolvedValue({
        articles: fetchedArticles,
      });

      const result = await controller.getFeedArticles(input);

      expect(result).toEqual({ results: fetchedArticles });
    });

    it("respects count", async () => {
      const input = {
        limit: 2,
        random: false,
        url: "url",
      };

      const fetchedArticles = [
        {
          id: "1",
        },
        {
          id: "2",
        },
        {
          id: "3",
        },
      ];

      jest.spyOn(feedFetcherService, "fetchFeedArticles").mockResolvedValue({
        articles: fetchedArticles,
      });

      const result = await controller.getFeedArticles(input);

      expect(result.results).toHaveLength(2);
    });
  });

  describe("sendTestArticle", () => {
    const validPayload = {
      type: "discord",
      feed: {
        url: "url",
      },
      mediumDetails: {
        channel: {
          id: "channel-id",
        },
        webhook: null,
      } as DiscordMediumTestPayloadDetails,
    };

    beforeEach(() => {
      feedFetcherService.fetchRandomFeedArticle.mockResolvedValue({
        id: "id",
      });
    });

    it("throws bad request if body type is unaccepted", async () => {
      const payload = {
        type: "invalid",
      };
      await expect(controller.sendTestArticle(payload)).rejects.toThrowError(
        BadRequestException
      );
    });

    it("throws bad request if medium details is malformed", async () => {
      const payload = {
        type: "discord",
        feed: {
          url: "url",
        },
        mediumDetails: {
          foo: "bar",
        },
      };

      await expect(controller.sendTestArticle(payload)).rejects.toThrowError(
        BadRequestException
      );
    });

    it("returns the correct result for no articles", async () => {
      feedFetcherService.fetchRandomFeedArticle.mockResolvedValue(null);

      expect(await controller.sendTestArticle(validPayload)).toEqual({
        status: TestDeliveryStatus.NoArticles,
      });
    });

    it("returns the correct result for >= 500 status", async () => {
      discordMediumService.deliverTestArticle.mockResolvedValue({
        state: "success",
        status: 500,
      });

      expect(await controller.sendTestArticle(validPayload)).toEqual({
        status: TestDeliveryStatus.ThirdPartyInternalError,
      });
    });

    it.each([401, 403])(
      "returns the correct result for missing permission %i status",
      async (status) => {
        discordMediumService.deliverTestArticle.mockResolvedValue({
          state: "success",
          status,
        });

        expect(await controller.sendTestArticle(validPayload)).toEqual({
          status: TestDeliveryStatus.MissingApplicationPermission,
        });
      }
    );

    it("returns the correct result for 404 status", async () => {
      discordMediumService.deliverTestArticle.mockResolvedValue({
        state: "success",
        status: 404,
      });

      expect(await controller.sendTestArticle(validPayload)).toEqual({
        status: TestDeliveryStatus.MissingChannel,
      });
    });

    it("returns the correct result for 429 status", async () => {
      discordMediumService.deliverTestArticle.mockResolvedValue({
        state: "success",
        status: 429,
      });

      expect(await controller.sendTestArticle(validPayload)).toEqual({
        status: TestDeliveryStatus.TooManyRequests,
      });
    });

    it("returns the correct result for 400 status", async () => {
      discordMediumService.deliverTestArticle.mockResolvedValue({
        state: "success",
        status: 400,
      });

      expect(await controller.sendTestArticle(validPayload)).toEqual({
        status: TestDeliveryStatus.BadPayload,
      });
    });

    it("returns the correct result for 200 status", async () => {
      discordMediumService.deliverTestArticle.mockResolvedValue({
        state: "success",
        status: 200,
      });

      expect(await controller.sendTestArticle(validPayload)).toEqual({
        status: TestDeliveryStatus.Success,
      });
    });

    it("throws an error if a status is unhandled", async () => {
      discordMediumService.deliverTestArticle.mockResolvedValue({
        state: "success",
        status: 418,
      });

      await expect(
        controller.sendTestArticle(validPayload)
      ).rejects.toThrowError();
    });
  });
});

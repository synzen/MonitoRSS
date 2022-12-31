import { BadRequestException } from "@nestjs/common";
import { FeedRequestParseException } from "../feed-fetcher/exceptions";
import {
  DiscordMediumTestPayloadDetails,
  GetFeedArticlesRequestStatus,
} from "../shared";
import { TestDeliveryStatus } from "./constants";
import { GetUserFeedArticlesInputDto } from "./dto";
import { FeedsController } from "./feeds.controller";

describe("FeedController", () => {
  const feedsService = {
    initializeFeed: jest.fn(),
    getRateLimitInformation: jest.fn(),
    getFilterExpressionErrors: jest.fn(),
    queryForArticles: jest.fn(),
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

  describe("createFeedFilterValidation", () => {
    it("returns the filter validation result", () => {
      const expression = {
        foo: "bar",
      };
      const errors = ["error"];
      jest
        .spyOn(feedsService, "getFilterExpressionErrors")
        .mockReturnValue(errors);

      const result = controller.createFeedFilterValidation({
        expression,
      });

      expect(result).toEqual({
        result: {
          errors,
        },
      });
    });
  });

  describe("getFeedArticles", () => {
    const url = "https://www.google.com?query=1&query=2";
    const sampleInput: GetUserFeedArticlesInputDto = {
      limit: 1,
      random: false,
      url: encodeURIComponent(url),
      skip: 0,
    };

    it("returns an empty array of results if request is pending", async () => {
      const input = {
        ...sampleInput,
      };

      jest
        .spyOn(feedFetcherService, "fetchFeedArticles")
        .mockResolvedValue(null);

      const result = await controller.getFeedArticles(input);

      expect(result.result.requestStatus).toEqual(
        GetFeedArticlesRequestStatus.Pending
      );
      expect(result.result.articles).toEqual([]);
    });

    it("returns an empty array of results if there are no articles", async () => {
      const input = {
        ...sampleInput,
      };

      jest.spyOn(feedFetcherService, "fetchFeedArticles").mockResolvedValue({
        articles: [],
      });

      const result = await controller.getFeedArticles(input);

      expect(result.result.requestStatus).toEqual(
        GetFeedArticlesRequestStatus.Success
      );
      expect(result.result.articles).toEqual([]);
    });

    it("returns an array of results if request is not pending", async () => {
      const input = {
        ...sampleInput,
      };

      const fetchedArticles = [
        {
          id: "1",
        },
      ];

      jest.spyOn(feedFetcherService, "fetchFeedArticles").mockResolvedValue({
        articles: fetchedArticles,
      });

      jest.spyOn(feedsService, "queryForArticles").mockResolvedValue({
        articles: fetchedArticles,
        filterEvalResults: [
          {
            passed: true,
          },
        ],
        properties: ["id"],
      });

      const result = await controller.getFeedArticles(input);

      expect(result.result.requestStatus).toEqual(
        GetFeedArticlesRequestStatus.Success
      );
      expect(result.result.articles).toEqual(fetchedArticles);
      expect(result.result.filterStatuses).toEqual([
        {
          passed: true,
        },
      ]);
      expect(result.result.selectedProperties).toEqual(["id"]);
    });

    it("handles parse error with no articles correctly", async () => {
      const input = {
        ...sampleInput,
      };

      jest
        .spyOn(feedFetcherService, "fetchFeedArticles")
        .mockRejectedValue(new FeedRequestParseException("random parse error"));

      const result = await controller.getFeedArticles(input);

      expect(result.result.requestStatus).toEqual(
        GetFeedArticlesRequestStatus.ParseError
      );
      expect(result.result.articles).toEqual([]);
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
      const apiPayload = {
        foo: "bar",
      };
      discordMediumService.deliverTestArticle.mockResolvedValue({
        result: {
          state: "success",
          status: 500,
        },
        apiPayload,
      });

      expect(await controller.sendTestArticle(validPayload)).toEqual({
        status: TestDeliveryStatus.ThirdPartyInternalError,
        apiPayload,
      });
    });

    it.each([401, 403])(
      "returns the correct result for missing permission %i status",
      async (status) => {
        const apiPayload = {
          foo: "bar",
        };
        discordMediumService.deliverTestArticle.mockResolvedValue({
          result: {
            state: "success",
            status,
          },
          apiPayload,
        });

        expect(await controller.sendTestArticle(validPayload)).toEqual({
          status: TestDeliveryStatus.MissingApplicationPermission,
          apiPayload,
        });
      }
    );

    it("returns the correct result for 404 status", async () => {
      const apiPayload = {
        foo: "bar",
      };
      discordMediumService.deliverTestArticle.mockResolvedValue({
        result: {
          state: "success",
          status: 404,
        },
        apiPayload,
      });

      expect(await controller.sendTestArticle(validPayload)).toEqual({
        status: TestDeliveryStatus.MissingChannel,
        apiPayload,
      });
    });

    it("returns the correct result for 429 status", async () => {
      const apiPayload = {
        foo: "bar",
      };
      discordMediumService.deliverTestArticle.mockResolvedValue({
        result: {
          state: "success",
          status: 429,
        },
        apiPayload,
      });

      expect(await controller.sendTestArticle(validPayload)).toEqual({
        status: TestDeliveryStatus.TooManyRequests,
        apiPayload,
      });
    });

    it("returns the correct result for 400 status", async () => {
      const apiPayload = {
        foo: "bar",
      };
      discordMediumService.deliverTestArticle.mockResolvedValue({
        result: {
          state: "success",
          status: 400,
        },
        apiPayload,
      });

      expect(await controller.sendTestArticle(validPayload)).toEqual({
        status: TestDeliveryStatus.BadPayload,
        apiPayload,
      });
    });

    it("returns the correct result for 200 status", async () => {
      const apiPayload = {
        foo: "bar",
      };
      discordMediumService.deliverTestArticle.mockResolvedValue({
        result: {
          state: "success",
          status: 200,
        },
        apiPayload,
      });

      expect(await controller.sendTestArticle(validPayload)).toEqual({
        status: TestDeliveryStatus.Success,
        apiPayload,
      });
    });

    it("throws an error if a status is unhandled", async () => {
      const apiPayload = {
        foo: "bar",
      };
      discordMediumService.deliverTestArticle.mockResolvedValue({
        result: {
          state: "success",
          status: 418,
        },
        apiPayload,
      });

      await expect(
        controller.sendTestArticle(validPayload)
      ).rejects.toThrowError();
    });
  });
});

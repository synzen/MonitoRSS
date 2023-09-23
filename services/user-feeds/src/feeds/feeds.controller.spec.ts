import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  FeedArticleNotFoundException,
  FeedRequestBadStatusCodeException,
  FeedRequestFetchException,
  FeedRequestParseException,
} from "../feed-fetcher/exceptions";
import {
  Article,
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
    fetchFeedArticle: jest.fn(),
  };
  const articleFormatterService = {
    formatArticleForDiscord: jest.fn(),
  };
  const articleFiltersService = {
    buildReferences: jest.fn(),
  };
  const deliveryRecordService = {
    countDeliveriesInPastTimeframe: jest.fn(),
  };
  let controller: FeedsController;

  beforeEach(async () => {
    jest.resetAllMocks();
    controller = new FeedsController(
      feedsService as never,
      discordMediumService as never,
      feedFetcherService as never,
      articleFormatterService as never,
      articleFiltersService as never,
      deliveryRecordService as never
    );
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
      formatter: {
        options: {
          formatTables: false,
          stripImages: true,
          disableImageLinkPreviews: false,
          customPlaceholders: [],
        },
      },
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
      expect(result.result.totalArticles).toEqual(0);
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
      expect(result.result.totalArticles).toEqual(0);
    });

    it("returns an array of results if request is not pending", async () => {
      const input = {
        ...sampleInput,
      };

      const fetchedArticles: Article[] = [
        {
          flattened: {
            id: "1",
            idHash: "1-hash",
          },
          raw: {} as never,
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
        totalArticles: 1,
      });

      jest
        .spyOn(articleFormatterService, "formatArticleForDiscord")
        .mockImplementation((article) => article);

      const result = await controller.getFeedArticles(input);

      expect(result.result.requestStatus).toEqual(
        GetFeedArticlesRequestStatus.Success
      );
      expect(result.result.articles).toEqual(
        fetchedArticles.map((a) => a.flattened)
      );
      expect(result.result.filterStatuses).toEqual([
        {
          passed: true,
        },
      ]);
      expect(result.result.selectedProperties).toEqual(["id"]);
      expect(result.result.totalArticles).toEqual(1);
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
      expect(result.result.totalArticles).toEqual(0);
    });

    it("handles feed request network exceptions correctly", async () => {
      const input = {
        ...sampleInput,
      };

      jest
        .spyOn(feedFetcherService, "fetchFeedArticles")
        .mockRejectedValue(
          new FeedRequestFetchException("random network error")
        );

      const result = await controller.getFeedArticles(input);

      expect(result.result.requestStatus).toEqual(
        GetFeedArticlesRequestStatus.FetchError
      );
      expect(result.result.articles).toEqual([]);
      expect(result.result.totalArticles).toEqual(0);
    });

    it("handles bad status code exceptions correctly", async () => {
      const input = {
        ...sampleInput,
      };

      jest
        .spyOn(feedFetcherService, "fetchFeedArticles")
        .mockRejectedValue(
          new FeedRequestBadStatusCodeException(
            "random bad status code error",
            403
          )
        );

      const result = await controller.getFeedArticles(input);

      expect(result.result.requestStatus).toEqual(
        GetFeedArticlesRequestStatus.BadStatusCode
      );
      expect(result.result.response?.statusCode).toEqual(403);
      expect(result.result.articles).toEqual([]);
      expect(result.result.totalArticles).toEqual(0);
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

    it("throws not found if article is not found", async () => {
      feedFetcherService.fetchFeedArticle.mockRejectedValue(
        new FeedArticleNotFoundException()
      );

      await expect(
        controller.sendTestArticle({
          ...validPayload,
          article: {
            id: "1",
          },
        })
      ).rejects.toThrowError(NotFoundException);
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

    it("returns the correct result for random article with 200 status", async () => {
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

    it("returns the correct result if specific article with 200 status", async () => {
      const apiPayload = {
        foo: "bar",
      };

      feedFetcherService.fetchFeedArticle.mockResolvedValue({
        id: "id",
      });

      discordMediumService.deliverTestArticle.mockResolvedValue({
        result: {
          state: "success",
          status: 200,
        },
        apiPayload,
      });

      const payload = {
        ...validPayload,
        article: {
          id: "id",
        },
      };

      expect(await controller.sendTestArticle(payload)).toEqual({
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

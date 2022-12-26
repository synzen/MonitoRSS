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
  let controller: FeedsController;

  beforeEach(async () => {
    controller = new FeedsController(
      feedsService as never,
      discordMediumService as never
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

  describe("sendTestArticle", () => {
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
        article: {},
        mediumDetails: {
          foo: "bar",
        },
      };

      await expect(controller.sendTestArticle(payload)).rejects.toThrowError(
        BadRequestException
      );
    });

    it("returns the correct result for >= 500 status", async () => {
      const payload = {
        type: "discord",
        article: {},
        mediumDetails: {
          channel: {
            id: "channel-id",
          },
          webhook: null,
        } as DiscordMediumTestPayloadDetails,
      };

      discordMediumService.deliverTestArticle.mockResolvedValue({
        state: "success",
        status: 500,
      });

      expect(await controller.sendTestArticle(payload)).toEqual({
        status: TestDeliveryStatus.ThirdPartyInternalError,
      });
    });

    it.each([401, 403])(
      "returns the correct result for missing permission %i status",
      async (status) => {
        const payload = {
          type: "discord",
          article: {},
          mediumDetails: {
            channel: {
              id: "channel-id",
            },
            webhook: null,
          } as DiscordMediumTestPayloadDetails,
        };

        discordMediumService.deliverTestArticle.mockResolvedValue({
          state: "success",
          status,
        });

        expect(await controller.sendTestArticle(payload)).toEqual({
          status: TestDeliveryStatus.MissingApplicationPermission,
        });
      }
    );

    it("returns the correct result for 404 status", async () => {
      const payload = {
        type: "discord",
        article: {},
        mediumDetails: {
          channel: {
            id: "channel-id",
          },
          webhook: null,
        } as DiscordMediumTestPayloadDetails,
      };

      discordMediumService.deliverTestArticle.mockResolvedValue({
        state: "success",
        status: 404,
      });

      expect(await controller.sendTestArticle(payload)).toEqual({
        status: TestDeliveryStatus.MissingChannel,
      });
    });

    it("returns the correct result for 429 status", async () => {
      const payload = {
        type: "discord",
        article: {},
        mediumDetails: {
          channel: {
            id: "channel-id",
          },
          webhook: null,
        } as DiscordMediumTestPayloadDetails,
      };

      discordMediumService.deliverTestArticle.mockResolvedValue({
        state: "success",
        status: 429,
      });

      expect(await controller.sendTestArticle(payload)).toEqual({
        status: TestDeliveryStatus.TooManyRequests,
      });
    });

    it("returns the correct result for 400 status", async () => {
      const payload = {
        type: "discord",
        article: {},
        mediumDetails: {
          channel: {
            id: "channel-id",
          },
          webhook: null,
        } as DiscordMediumTestPayloadDetails,
      };

      discordMediumService.deliverTestArticle.mockResolvedValue({
        state: "success",
        status: 400,
      });

      expect(await controller.sendTestArticle(payload)).toEqual({
        status: TestDeliveryStatus.BadPayload,
      });
    });

    it("returns the correct result for 200 status", async () => {
      const payload = {
        type: "discord",
        article: {},
        mediumDetails: {
          channel: {
            id: "channel-id",
          },
          webhook: null,
        } as DiscordMediumTestPayloadDetails,
      };

      discordMediumService.deliverTestArticle.mockResolvedValue({
        state: "success",
        status: 200,
      });

      expect(await controller.sendTestArticle(payload)).toEqual({
        status: TestDeliveryStatus.Success,
      });
    });

    it("throws an error if a status is unhandled", async () => {
      const payload = {
        type: "discord",
        article: {},
        mediumDetails: {
          channel: {
            id: "channel-id",
          },
          webhook: null,
        } as DiscordMediumTestPayloadDetails,
      };

      discordMediumService.deliverTestArticle.mockResolvedValue({
        state: "success",
        status: 418,
      });

      await expect(controller.sendTestArticle(payload)).rejects.toThrowError();
    });
  });
});

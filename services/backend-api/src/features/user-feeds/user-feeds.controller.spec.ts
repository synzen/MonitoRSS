import { NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import {
  FeedConnectionDisabledCode,
  FeedConnectionType,
} from "../feeds/constants";
import { GetUserFeedArticlesInputDto, SendTestArticleInputDto } from "./dto";
import { UserFeedDisabledCode, UserFeedHealthStatus } from "./types";
import { UserFeedsController } from "./user-feeds.controller";
import { SendTestArticleResult } from "../../services/feed-handler/types";
import { TestDeliveryStatus } from "../../services/feed-handler/constants";

describe("UserFeedsController", () => {
  let controller: UserFeedsController;
  const userFeedsService = {
    addFeed: jest.fn(),
    updateFeedById: jest.fn(),
    retryFailedFeed: jest.fn(),
    getFeedDailyLimit: jest.fn(),
    getFeedArticles: jest.fn(),
    getFeedArticleProperties: jest.fn(),
  };
  const supportersService = {
    getBenefitsOfDiscordUser: jest.fn(),
  };
  const feedConnectionsService = {
    sendTestArticleDirect: jest.fn(),
  };
  const feedsService = {
    canUseChannel: jest.fn(),
  };
  const discordUserId = "discord-user-id";
  const feed = {
    title: "title",
    url: "url",
    _id: new Types.ObjectId(),
    user: {
      discordUserId,
    },
    disabledCode: UserFeedDisabledCode.Manual,
    healthStatus: UserFeedHealthStatus.Failed,
    formatOptions: {
      dateFormat: "dateFormat",
    },
    connections: {
      discordChannels: [
        {
          id: new Types.ObjectId(),
          name: "discord channel con name",
          disabledCode: FeedConnectionDisabledCode.Manual,
          filters: {
            expression: {
              foo: "discord channel filters",
            },
          },
          details: {
            hello: "discord channel details",
          },
        },
      ],
      discordWebhooks: [
        {
          id: new Types.ObjectId(),
          name: "discord webhook con name",
          disabledCode: FeedConnectionDisabledCode.Manual,
          filters: {
            expression: {
              foo: "discord webhook filters",
            },
          },
          details: {
            hello: "discord webhook details",
          },
        },
      ],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    supportersService.getBenefitsOfDiscordUser.mockResolvedValue({
      refreshRateSeconds: 60,
    });
    feedsService.canUseChannel.mockResolvedValue(undefined);
    controller = new UserFeedsController(
      userFeedsService as never,
      supportersService as never,
      feedConnectionsService as never,
      feedsService as never
    );
  });

  describe("getFeed", () => {
    it("returns the feed and refresh rate", async () => {
      supportersService.getBenefitsOfDiscordUser.mockResolvedValue({
        refreshRateSeconds: 123,
      } as never);

      const result = await controller.getFeed(feed as never);

      expect(result).toMatchObject({
        result: {
          id: feed._id.toHexString(),
          title: feed.title,
          url: feed.url,
          healthStatus: feed.healthStatus,
          disabledCode: feed.disabledCode,
          refreshRateSeconds: 123,
          formatOptions: feed.formatOptions,
          connections: [
            ...feed.connections.discordChannels.map((con) => ({
              id: con.id.toHexString(),
              name: con.name,
              key: FeedConnectionType.DiscordChannel,
              details: con.details,
              filters: con.filters,
              disabledCode: FeedConnectionDisabledCode.Manual,
            })),
            ...feed.connections.discordWebhooks.map((con) => ({
              id: con.id.toHexString(),
              name: con.name,
              key: FeedConnectionType.DiscordWebhook,
              details: con.details,
              filters: con.filters,
              disabledCode: FeedConnectionDisabledCode.Manual,
            })),
          ],
        },
      });
    });
  });

  describe("getArticleProperties", () => {
    it("returns the properties", async () => {
      jest
        .spyOn(userFeedsService, "getFeedArticleProperties")
        .mockResolvedValue({
          properties: ["id", "title"],
          requestStatus: "success",
        } as never);

      const result = await controller.getArticleProperties(feed as never);

      expect(result).toMatchObject({
        result: {
          properties: ["id", "title"],
          requestStatus: "success",
        },
      });
    });
  });

  describe("getFeedArticles", () => {
    it("returns correctly", async () => {
      jest.spyOn(userFeedsService, "getFeedArticles").mockResolvedValue({
        articles: [],
        requestStatus: "success",
        filterStatuses: [
          {
            passed: true,
          },
        ],
        selectedProperties: ["id"],
        totalArticles: 10,
      });

      const input: GetUserFeedArticlesInputDto = {
        limit: 10,
        random: true,
        skip: 10,
        formatter: {
          options: {
            formatTables: false,
            stripImages: false,
            disableImageLinkPreviews: false,
          },
        },
      };
      const result = await controller.getFeedArticles(input, feed as never);

      expect(result).toMatchObject({
        result: {
          articles: [],
          requestStatus: "success",
          filterStatuses: [
            {
              passed: true,
            },
          ],
          totalArticles: 10,
          selectedProperties: ["id"],
        },
      });
    });
  });

  describe("retryFailedFeed", () => {
    it("returns the feed", async () => {
      supportersService.getBenefitsOfDiscordUser.mockResolvedValue({
        refreshRateSeconds: 123,
      } as never);
      userFeedsService.retryFailedFeed.mockResolvedValue(feed as never);

      const result = await controller.retryFailedFeed(
        {
          discord: {
            id: discordUserId,
          },
        } as never,
        feed as never
      );

      expect(result).toMatchObject({
        result: {
          id: feed._id.toHexString(),
          title: feed.title,
          url: feed.url,
          healthStatus: feed.healthStatus,
          disabledCode: feed.disabledCode,
          refreshRateSeconds: 123,
          formatOptions: feed.formatOptions,
          connections: [
            ...feed.connections.discordChannels.map((con) => ({
              id: con.id.toHexString(),
              name: con.name,
              key: FeedConnectionType.DiscordChannel,
              details: con.details,
              filters: con.filters,
            })),
            ...feed.connections.discordWebhooks.map((con) => ({
              id: con.id.toHexString(),
              name: con.name,
              key: FeedConnectionType.DiscordWebhook,
              details: con.details,
              filters: con.filters,
            })),
          ],
        },
      });
    });
  });

  describe("getDailyLimits", () => {
    it("returns the daily limits", async () => {
      userFeedsService.getFeedDailyLimit.mockResolvedValue({
        progress: 100,
        max: 1000,
      });

      const result = await controller.getDailyLimit(feed as never);

      expect(result).toMatchObject({
        result: {
          current: 100,
          max: 1000,
        },
      });
    });

    it("throws not found if daily limit is not found", async () => {
      userFeedsService.getFeedDailyLimit.mockResolvedValue(undefined);

      await expect(controller.getDailyLimit(feed as never)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe("updateFeed", () => {
    it("returns the updated feed", async () => {
      const updateBody = {
        title: "updated title",
      };

      jest
        .spyOn(userFeedsService, "updateFeedById")
        .mockResolvedValue(feed as never);

      const result = await controller.updateFeed(feed as never, updateBody);

      expect(result).toMatchObject({
        result: {
          id: feed._id.toHexString(),
          title: feed.title,
          url: feed.url,
          healthStatus: feed.healthStatus,
          disabledCode: feed.disabledCode,
          refreshRateSeconds: 60,
          formatOptions: feed.formatOptions,
          connections: [
            ...feed.connections.discordChannels.map((con) => ({
              id: con.id.toHexString(),
              name: con.name,
              key: FeedConnectionType.DiscordChannel,
              details: con.details,
              filters: con.filters,
            })),
            ...feed.connections.discordWebhooks.map((con) => ({
              id: con.id.toHexString(),
              name: con.name,
              key: FeedConnectionType.DiscordWebhook,
              details: con.details,
              filters: con.filters,
            })),
          ],
        },
      });
    });
  });

  describe("sendTestArticle", () => {
    const accessToken = { access_token: "test-token" };

    it("validates channel permission and calls sendTestArticleDirect", async () => {
      const testArticleResult: SendTestArticleResult = {
        status: TestDeliveryStatus.Success,
        apiPayload: { content: "test" },
      };

      feedConnectionsService.sendTestArticleDirect.mockResolvedValue(
        testArticleResult
      );

      const input: SendTestArticleInputDto = {
        article: { id: "article-1" },
        channelId: "channel-123",
        content: "Test content",
      };

      const result = await controller.sendTestArticle(
        [{ feed }] as never,
        input,
        accessToken as never
      );

      expect(feedsService.canUseChannel).toHaveBeenCalledWith({
        channelId: "channel-123",
        userAccessToken: "test-token",
      });

      expect(feedConnectionsService.sendTestArticleDirect).toHaveBeenCalledWith(
        feed,
        {
          article: { id: "article-1" },
          channelId: "channel-123",
          content: "Test content",
          embeds: undefined,
          componentsV2: undefined,
          placeholderLimits: undefined,
          webhook: undefined,
          threadId: undefined,
          userFeedFormatOptions: undefined,
        }
      );

      expect(result).toEqual({
        result: testArticleResult,
      });
    });

    it("passes all optional parameters correctly", async () => {
      const testArticleResult: SendTestArticleResult = {
        status: TestDeliveryStatus.Success,
        apiPayload: { content: "test" },
      };

      feedConnectionsService.sendTestArticleDirect.mockResolvedValue(
        testArticleResult
      );

      const input: SendTestArticleInputDto = {
        article: { id: "article-1" },
        channelId: "channel-123",
        content: "Test content",
        embeds: [{ title: "Test Embed" }],
        threadId: "thread-456",
        webhook: {
          name: "Test Webhook",
          iconUrl: "https://example.com/icon.png",
        },
        placeholderLimits: [{ placeholder: "title", characterCount: 100 }],
        userFeedFormatOptions: { dateFormat: "YYYY-MM-DD" },
      };

      await controller.sendTestArticle(
        [{ feed }] as never,
        input,
        accessToken as never
      );

      expect(feedConnectionsService.sendTestArticleDirect).toHaveBeenCalledWith(
        feed,
        {
          article: { id: "article-1" },
          channelId: "channel-123",
          content: "Test content",
          embeds: [{ title: "Test Embed" }],
          componentsV2: undefined,
          placeholderLimits: [{ placeholder: "title", characterCount: 100 }],
          webhook: {
            name: "Test Webhook",
            iconUrl: "https://example.com/icon.png",
          },
          threadId: "thread-456",
          userFeedFormatOptions: { dateFormat: "YYYY-MM-DD" },
        }
      );
    });
  });
});

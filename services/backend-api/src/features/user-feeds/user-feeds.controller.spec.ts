import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import { FeedConnectionType } from "../feeds/constants";
import { UserFeedDisabledCode, UserFeedHealthStatus } from "./types";
import { UserFeedsController } from "./user-feeds.controller";

describe("UserFeedsController", () => {
  let controller: UserFeedsController;
  const userFeedsService = {
    addFeed: jest.fn(),
    updateFeedById: jest.fn(),
    retryFailedFeed: jest.fn(),
    getFeedDailyLimit: jest.fn(),
  };
  const supportersService = {
    getBenefitsOfDiscordUser: jest.fn(),
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
    connections: {
      discordChannels: [
        {
          id: new Types.ObjectId(),
          name: "discord channel con name",
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
    controller = new UserFeedsController(
      userFeedsService as never,
      supportersService as never
    );
  });

  describe("getFeed", () => {
    it("returns the feed and refresh rate", async () => {
      supportersService.getBenefitsOfDiscordUser.mockResolvedValue({
        refreshRateSeconds: 123,
      } as never);

      const result = await controller.getFeed(
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

    it("throws a not found exception if the feed does not belong to the user", async () => {
      const feed = {
        title: "title",
        url: "url",
        _id: new Types.ObjectId(),
        user: {
          discordUserId: "other discord id",
        },
        connections: {
          discordChannels: [],
          discordWebhooks: [],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await expect(
        controller.getFeed(
          {
            discord: {
              id: discordUserId,
            },
          } as never,
          feed as never
        )
      ).rejects.toThrow(NotFoundException);
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

    it("throws a not found exception if the feed does not belong to the user", async () => {
      const discordUserId = "discord id";
      const feed = {
        title: "title",
        url: "url",
        _id: new Types.ObjectId(),
        user: {
          discordUserId: "other discord id",
        },
        connections: {
          discordChannels: [],
          discordWebhooks: [],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await expect(
        controller.retryFailedFeed(
          {
            discord: {
              id: discordUserId,
            },
          } as never,
          feed as never
        )
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("getDailyLimits", () => {
    it("returns the daily limits", async () => {
      userFeedsService.getFeedDailyLimit.mockResolvedValue({
        progress: 100,
        max: 1000,
      });

      const result = await controller.getDailyLimit(
        {
          discord: {
            id: discordUserId,
          },
        } as never,
        feed as never
      );

      expect(result).toMatchObject({
        result: {
          current: 100,
          max: 1000,
        },
      });
    });

    it("throws not found if daily limit is not found", async () => {
      userFeedsService.getFeedDailyLimit.mockResolvedValue(undefined);

      await expect(
        controller.getDailyLimit(
          {
            discord: {
              id: discordUserId,
            },
          } as never,
          feed as never
        )
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateFeed", () => {
    it("throws forbidden exception if discord user id does not match feed", async () => {
      const feed = {
        user: {
          discordUserId: "discord user id",
        },
      } as never;

      await expect(
        controller.updateFeed(
          {
            discord: {
              id: "other discord user id",
            },
          } as never,
          feed,
          {
            title: "title",
            url: "url",
          }
        )
      ).rejects.toThrow(ForbiddenException);
    });
    it("returns the updated feed", async () => {
      const accessTokenInfo = {
        discord: {
          id: "discord-user-id",
        },
      };

      const feed = {
        title: "title",
        url: "url",
        _id: new Types.ObjectId(),
        user: {
          discordUserId: accessTokenInfo.discord.id,
        },
      };

      const updateBody = {
        title: "updated title",
      };

      jest
        .spyOn(userFeedsService, "updateFeedById")
        .mockResolvedValue(feed as never);

      const result = await controller.updateFeed(
        accessTokenInfo as never,
        feed as never,
        updateBody
      );

      expect(result).toMatchObject({
        result: {
          title: feed.title,
          url: feed.url,
          id: feed._id.toHexString(),
        },
      });
    });
  });
});

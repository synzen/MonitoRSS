import { ForbiddenException } from "@nestjs/common";
import { Types } from "mongoose";
import { UserFeedsController } from "./user-feeds.controller";

describe("UserFeedsController", () => {
  let controller: UserFeedsController;
  const userFeedsService = {
    addFeed: jest.fn(),
    updateFeedById: jest.fn(),
  };

  beforeEach(async () => {
    controller = new UserFeedsController(userFeedsService as never);
  });

  describe("createFeed", () => {
    it("returns the created feed", async () => {
      const createdFeed = {
        title: "title",
        url: "url",
        _id: new Types.ObjectId(),
      };
      userFeedsService.addFeed.mockResolvedValue(createdFeed as never);

      const result = await controller.createFeed(
        {
          title: createdFeed.title,
          url: createdFeed.url,
        },
        {
          discord: {
            id: "discord id",
          },
        } as never
      );

      expect(result).toMatchObject({
        result: {
          title: createdFeed.title,
          url: createdFeed.url,
          id: createdFeed._id.toHexString(),
        },
      });
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

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
          access_token: "token",
        } as never
      );

      expect(result).toMatchObject({
        data: {
          title: createdFeed.title,
          url: createdFeed.url,
          id: createdFeed._id.toHexString(),
        },
      });
    });
  });

  describe("updateFeed", () => {
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

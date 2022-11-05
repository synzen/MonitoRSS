import { Types } from "mongoose";
import { UserFeedsController } from "./user-feeds.controller";

describe("UserFeedsController", () => {
  let controller: UserFeedsController;
  const userFeedsService = {
    addFeed: jest.fn(),
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
});

import { NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import { GetUserFeedPipe } from "./get-user-feed.pipe";

describe("GetUserFeedPioe", () => {
  let pipe: GetUserFeedPipe;
  const userFeedsService = {
    getFeedById: jest.fn(),
  };
  const request = {
    session: {
      get: jest.fn(),
    },
  };
  const discordUserId = "discord-user-id";
  const feedId = new Types.ObjectId();

  beforeEach(() => {
    jest.resetAllMocks();
    request.session.get.mockReturnValue({
      discord: {
        id: discordUserId,
      },
    });
    pipe = new GetUserFeedPipe(userFeedsService as never, request as never);
  });

  it("returns the feed with the id", async () => {
    const feed = {
      id: feedId,
      user: {
        discordUserId,
      },
    };

    userFeedsService.getFeedById.mockResolvedValue(feed);

    await expect(pipe.transform(feedId as never)).resolves.toEqual(feed);
  });

  it("throws an error if the feed is not found", async () => {
    userFeedsService.getFeedById.mockResolvedValue(null);

    await expect(pipe.transform(feedId as never)).rejects.toThrow(
      NotFoundException
    );
  });

  it("throws an error if the feed id is not valid", async () => {
    userFeedsService.getFeedById.mockResolvedValue(null);

    await expect(pipe.transform(feedId as never)).rejects.toThrow(
      NotFoundException
    );
  });

  it("throws an error if the feed does not belong to the user", async () => {
    const feed = {
      id: feedId,
      user: {
        discordUserId: "other user id",
      },
    };

    userFeedsService.getFeedById.mockResolvedValue(feed);

    await expect(pipe.transform(feedId as never)).rejects.toThrow(
      NotFoundException
    );
  });
});

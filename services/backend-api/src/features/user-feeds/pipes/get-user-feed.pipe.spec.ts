import { NotFoundException, PipeTransform } from "@nestjs/common";
import { Types } from "mongoose";
import { UserFeedManagerType } from "../constants/user-feed-manager-type.types";
import { NoPermissionException } from "../exceptions/no-permission.exception";
import { GetUserFeedPipe } from "./get-user-feed.pipe";

describe("GetUserFeedPioe", () => {
  let pipe: PipeTransform;
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
    pipe = new (GetUserFeedPipe())(userFeedsService as never, request as never);
  });

  it("returns the feed with the id", async () => {
    const feed = {
      id: feedId,
      user: {
        discordUserId,
      },
    };

    userFeedsService.getFeedById.mockResolvedValue(feed);

    await expect(pipe.transform(feedId as never, {} as never)).resolves.toEqual(
      feed
    );
  });

  it("returns the feed with the id if user is a shared manager", async () => {
    const feed = {
      id: feedId,
      user: {
        discordUserId: discordUserId + "other",
      },
      shareManageOptions: {
        users: [
          {
            discordUserId,
          },
        ],
      },
    };

    userFeedsService.getFeedById.mockResolvedValue(feed);

    await expect(pipe.transform(feedId as never, {} as never)).resolves.toEqual(
      feed
    );
  });

  it("throws if user is a shared manager but access controls explicitly deny them", async () => {
    const feed = {
      id: feedId,
      user: {
        discordUserId: discordUserId + "other",
      },
      shareManageOptions: {
        users: [
          {
            discordUserId,
          },
        ],
      },
    };

    userFeedsService.getFeedById.mockResolvedValue(feed);

    pipe = new (GetUserFeedPipe({
      userTypes: [UserFeedManagerType.Creator],
    }))(userFeedsService as never, request as never);

    await expect(pipe.transform(feedId as never, {} as never)).rejects.toThrow(
      NoPermissionException
    );
  });

  it("throws an error if the feed is not found", async () => {
    userFeedsService.getFeedById.mockResolvedValue(null);

    await expect(pipe.transform(feedId as never, {} as never)).rejects.toThrow(
      NotFoundException
    );
  });

  it("throws an error if the feed id is not valid", async () => {
    userFeedsService.getFeedById.mockResolvedValue(null);

    await expect(pipe.transform(feedId as never, {} as never)).rejects.toThrow(
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

    await expect(pipe.transform(feedId as never, {} as never)).rejects.toThrow(
      NotFoundException
    );
  });
});

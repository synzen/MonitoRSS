import { NotFoundException } from "@nestjs/common";
import { GetUserFeedPipe } from "./get-user-feed.pipe";

describe("GetUserFeedPioe", () => {
  let pipe: GetUserFeedPipe;
  const userFeedsService = {
    getFeedById: jest.fn(),
  };

  beforeEach(() => {
    pipe = new GetUserFeedPipe(userFeedsService as never);
  });

  it("returns the feed with the id", () => {
    const feedId = "feed id";
    const feed = { id: "feed id" };

    userFeedsService.getFeedById.mockResolvedValue(feed);

    expect(pipe.transform(feedId as never)).resolves.toEqual(feed);
  });

  it("throws an error if the feed is not found", () => {
    const feedId = "feed id";

    userFeedsService.getFeedById.mockResolvedValue(null);

    expect(pipe.transform(feedId as never)).rejects.toThrow(NotFoundException);
  });

  it("throws an error if the feed id is not valid", () => {
    const feedId = "feed id";

    userFeedsService.getFeedById.mockResolvedValue(null);

    expect(pipe.transform(feedId as never)).rejects.toThrow(NotFoundException);
  });
});

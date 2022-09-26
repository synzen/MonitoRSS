import { BadRequestException, NotFoundException } from "@nestjs/common";
import { FeedsService } from "../feeds.service";
import { GetFeedPipe } from "./GetFeed.pipe";
import { Types } from "mongoose";

describe("GetFeedPipe", () => {
  let feedsService: FeedsService;
  let pipe: GetFeedPipe;
  const feedId = new Types.ObjectId().toHexString();

  beforeEach(() => {
    feedsService = {
      getFeed: jest.fn(),
    } as never;

    pipe = new GetFeedPipe(feedsService);
  });

  it("throws bad request if feed id is not an object id", async () => {
    await expect(pipe.transform("not-an-object-id")).rejects.toThrow(
      BadRequestException
    );
  });

  it("throws not found if feed is not found", async () => {
    jest.spyOn(feedsService, "getFeed").mockResolvedValue(null);

    await expect(pipe.transform(feedId)).rejects.toThrow(NotFoundException);
  });

  it("returns the feed", async () => {
    const feed = {
      id: feedId,
    } as never;

    jest.spyOn(feedsService, "getFeed").mockResolvedValue(feed);

    await expect(pipe.transform(feedId)).resolves.toEqual(feed);
  });
});

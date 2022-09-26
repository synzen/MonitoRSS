import { NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import { FeedSubscribersService } from "../feed-subscribers.service";
import { GetFeedSubscriberPipe } from "./GetFeedSubscriber.pipe";

describe("GetFeedSubscriberPipe", () => {
  let subscriberService: FeedSubscribersService;
  let pipe: GetFeedSubscriberPipe;
  const subscriberId = new Types.ObjectId().toHexString();

  beforeEach(() => {
    subscriberService = {
      findByIdAndFeed: jest.fn(),
    } as never;

    pipe = new GetFeedSubscriberPipe(subscriberService);
  });

  it("throws not found if subscriber is not found", async () => {
    jest.spyOn(subscriberService, "findByIdAndFeed").mockResolvedValue(null);

    await expect(
      pipe.transform({
        subscriberId,
        feedId: "feed-id",
      })
    ).rejects.toThrow(NotFoundException);
  });

  it("returns the subscriber", async () => {
    const item = {
      id: subscriberId,
    } as never;

    jest.spyOn(subscriberService, "findByIdAndFeed").mockResolvedValue(item);

    await expect(
      pipe.transform({
        subscriberId,
        feedId: "feed-id",
      })
    ).resolves.toEqual(item);
  });
});

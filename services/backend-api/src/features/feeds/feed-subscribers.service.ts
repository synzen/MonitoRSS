import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Types } from "mongoose";
import {
  FeedSubscriber,
  FeedSubscriberModel,
  FeedSubscriberType,
} from "./entities/feed-subscriber.entity";

interface CreateFeedSubscriberDetails {
  type: FeedSubscriberType;
  discordId: string;
  feedId: string;
}

interface UpdateFeedSubscriberDetails {
  filters?: Array<{ category: string; value: string }>;
}

@Injectable()
export class FeedSubscribersService {
  constructor(
    @InjectModel(FeedSubscriber.name)
    private readonly feedSubscriber: FeedSubscriberModel
  ) {}

  async getSubscribersOfFeed(
    feedId: string | Types.ObjectId
  ): Promise<FeedSubscriber[]> {
    const subscribers = await this.feedSubscriber
      .find({
        feed: feedId,
      })
      .sort({
        createdAt: -1,
      })
      .lean();

    return subscribers;
  }

  async createFeedSubscriber(
    details: CreateFeedSubscriberDetails
  ): Promise<FeedSubscriber> {
    if (!Types.ObjectId.isValid(details.feedId)) {
      throw new Error(
        "Feed ID is not a valid ObjectId when trying to create a feed subscriber"
      );
    }

    const subscriber = await this.feedSubscriber.create({
      type: details.type,
      id: details.discordId,
      feed: new Types.ObjectId(details.feedId),
    });

    return subscriber;
  }

  async remove(subscriberId: Types.ObjectId | string) {
    await this.feedSubscriber.deleteOne({
      _id: subscriberId,
    });
  }

  async findByIdAndFeed({
    subscriberId,
    feedId,
  }: {
    subscriberId: Types.ObjectId | string;
    feedId: Types.ObjectId | string;
  }) {
    return this.feedSubscriber
      .findOne({
        _id: new Types.ObjectId(subscriberId),
        feed: new Types.ObjectId(feedId),
      })
      .lean();
  }

  async updateOne(
    subscriberId: Types.ObjectId | string,
    { filters }: UpdateFeedSubscriberDetails
  ): Promise<FeedSubscriber> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mongoUpdate: Record<string, any> = {
      $set: {},
    };

    if (filters) {
      mongoUpdate.$set.filters = {};

      filters.forEach(({ category, value }) => {
        const currentArr: string[] | undefined =
          mongoUpdate.$set.filters[category];

        if (!currentArr) {
          mongoUpdate.$set.filters[category] = [value];
        } else if (!currentArr.includes(value)) {
          mongoUpdate.$set.filters[category].push(value);
        }
      });
    }

    const updated = await this.feedSubscriber
      .findOneAndUpdate({ _id: subscriberId }, mongoUpdate, {
        new: true,
      })
      .lean();

    if (!updated) {
      throw new Error(
        `Could not find subscriber with ID ${subscriberId} to update`
      );
    }

    return updated;
  }
}

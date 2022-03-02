import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Feed, FeedModel } from './entities/Feed.entity';
import { FeedWithRefreshRate } from './types/FeedWithRefreshRate';
import { Types } from 'mongoose';
import _ from 'lodash';
import { FailRecord, FailRecordModel } from './entities/fail-record.entity';

interface UpdateFeedInput {
  text?: string;
}

@Injectable()
export class FeedsService {
  constructor(
    @InjectModel(Feed.name) private readonly feedModel: FeedModel,
    @InjectModel(FailRecord.name) private readonly failRecord: FailRecordModel,
  ) {}

  async getFeed(feedId: string): Promise<FeedWithRefreshRate | null> {
    const feed: Feed = await this.feedModel.findById(feedId).lean();

    if (!feed) {
      return null;
    }

    return {
      ...feed,
      refreshRateSeconds: 10,
    };
  }

  async updateOne(
    feedId: string | Types.ObjectId,
    input: UpdateFeedInput,
  ): Promise<FeedWithRefreshRate> {
    const strippedUpdateObject = _.omitBy(input, _.isUndefined);

    const feed: Feed = await this.feedModel
      .findByIdAndUpdate(feedId, strippedUpdateObject, { new: true })
      .lean();

    if (!feed) {
      throw new Error(`Feed ${feedId} does not exist`);
    }

    return {
      ...feed,
      refreshRateSeconds: 10,
    };
  }

  async refresh(feedId: string | Types.ObjectId): Promise<FeedWithRefreshRate> {
    const feed = await this.feedModel.findById(feedId).lean();

    if (!feed) {
      throw new Error(`Feed ${feedId} does not exist`);
    }

    await this.failRecord.deleteOne({ _id: feed.url });

    return {
      ...feed,
      refreshRateSeconds: 10,
    };
  }
}

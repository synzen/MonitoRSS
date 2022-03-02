import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Feed, FeedModel } from './entities/Feed.entity';
import { FeedWithRefreshRate } from './types/FeedWithRefreshRate';
import { Types } from 'mongoose';
import _ from 'lodash';
import { FailRecord, FailRecordModel } from './entities/fail-record.entity';
import { FeedStatus } from './types/FeedStatus.type';

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

    const feedStatuses = await this.getFeedStatuses([feed]);

    return {
      ...feed,
      status: feedStatuses[0].status,
      refreshRateSeconds: 10,
    };
  }

  async getServerFeeds(
    serverId: string,
    options: {
      limit: number;
      offset: number;
    },
  ): Promise<FeedWithRefreshRate[]> {
    const feeds = await this.feedModel
      .find({ guild: serverId })
      .limit(options.limit)
      .skip(options.offset)
      .sort({ addedAt: -1 })
      .lean();

    const feedStatuses = await this.getFeedStatuses(feeds);

    return feeds.map((feed, i) => ({
      ...feed,
      status: feedStatuses[i].status,
      refreshRateSeconds: 10,
    }));
  }

  async countServerFeeds(serverId: string): Promise<number> {
    return this.feedModel.countDocuments({ serverId });
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

    const feedStatuses = await this.getFeedStatuses([feed]);

    return {
      ...feed,
      status: feedStatuses[0].status,
      refreshRateSeconds: 10,
    };
  }

  async refresh(feedId: string | Types.ObjectId): Promise<FeedWithRefreshRate> {
    const feed = await this.feedModel.findById(feedId).lean();

    if (!feed) {
      throw new Error(`Feed ${feedId} does not exist`);
    }

    await this.failRecord.deleteOne({ _id: feed.url });

    const feedStatuses = await this.getFeedStatuses([feed]);

    return {
      ...feed,
      ...feedStatuses[0],
      refreshRateSeconds: 10,
    };
  }

  async getFeedStatuses(feed: Feed[]): Promise<{ status: FeedStatus }[]> {
    const feedUrls = feed.map((feed) => feed.url);

    const failRecords = await this.failRecord.find({
      url: { $in: feedUrls },
    });

    const detailedFeeds = feed.map((feed) => ({
      status: failRecords.some((record) => record._id === feed.url)
        ? FeedStatus.FAILED
        : FeedStatus.OK,
    }));

    return detailedFeeds;
  }
}

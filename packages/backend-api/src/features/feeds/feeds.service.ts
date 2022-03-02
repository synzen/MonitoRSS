import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Feed, FeedDocument, FeedModel } from './entities/Feed.entity';
import { FeedWithRefreshRate } from './types/FeedWithRefreshRate';
import { Types, FilterQuery } from 'mongoose';
import _ from 'lodash';
import { FailRecord, FailRecordModel } from './entities/fail-record.entity';
import { FeedStatus } from './types/FeedStatus.type';

interface UpdateFeedInput {
  text?: string;
}

interface PopulatedFeed extends Feed {
  failRecord?: FailRecord;
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
    const feeds = await this.findFeeds(
      {
        guild: serverId,
      },
      {
        limit: options.limit,
        skip: options.offset,
      },
    );

    return feeds;
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

    const foundFeeds = await this.findFeeds(
      {
        _id: new Types.ObjectId(feedId),
      },
      {
        limit: 1,
        skip: 0,
      },
    );

    return foundFeeds[0];
  }

  async refresh(feedId: string | Types.ObjectId): Promise<FeedWithRefreshRate> {
    const feed = await this.feedModel.findById(feedId).lean();

    if (!feed) {
      throw new Error(`Feed ${feedId} does not exist`);
    }

    await this.failRecord.deleteOne({ _id: feed.url });

    const feeds = await this.findFeeds(
      {
        _id: new Types.ObjectId(feedId),
      },
      {
        limit: 1,
        skip: 0,
      },
    );

    return feeds[0];
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

  private async findFeeds(
    filter: FilterQuery<FeedDocument>,
    options: {
      limit: number;
      skip: number;
    },
  ): Promise<FeedWithRefreshRate[]> {
    const feeds: PopulatedFeed[] = await this.feedModel.aggregate([
      {
        $match: filter,
      },
      {
        $sort: {
          addedAt: -1,
        },
      },
      {
        $skip: options.skip,
      },
      {
        $limit: options.limit,
      },
      {
        $lookup: {
          from: 'fail_records',
          localField: 'url',
          foreignField: '_id',
          as: 'failRecord',
        },
      },
      {
        $addFields: {
          failRecord: {
            $first: '$failRecord',
          },
        },
      },
    ]);

    return feeds.map((feed) => ({
      ...feed,
      status: feed.failRecord ? FeedStatus.FAILED : FeedStatus.OK,
      refreshRateSeconds: 10,
    }));
  }
}

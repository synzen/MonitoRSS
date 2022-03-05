import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Feed, FeedDocument, FeedModel } from './entities/Feed.entity';
import { FeedWithRefreshRate } from './types/FeedWithRefreshRate';
import { Types, FilterQuery } from 'mongoose';
import _ from 'lodash';
import { FailRecord, FailRecordModel } from './entities/fail-record.entity';
import { FeedStatus } from './types/FeedStatus.type';
import dayjs from 'dayjs';

interface UpdateFeedInput {
  text?: string;
  webhook?: {
    id?: string;
  };
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
    const feeds = await this.findFeeds(
      {
        _id: new Types.ObjectId(feedId),
      },
      {
        limit: 1,
        skip: 0,
      },
    );

    const matchedFeed = feeds[0];

    if (!matchedFeed) {
      return null;
    }

    return matchedFeed;
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
    const strippedUpdateObject: UpdateFeedInput = _.omitBy(
      input,
      _.isUndefined,
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateObject: Record<string, any> = {
      $set: {},
    };

    if (strippedUpdateObject.text != null) {
      updateObject.$set.text = strippedUpdateObject.text;
    }

    if (strippedUpdateObject.webhook?.id != null) {
      updateObject.$set.webhook = {
        id: strippedUpdateObject.webhook.id,
      };
    }

    const res = await this.feedModel.updateOne(
      {
        _id: feedId,
      },
      updateObject,
    );

    console.log(await this.feedModel.find());

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

  async findFeeds(
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

    const withStatuses = feeds.map((feed) => ({
      ...feed,
      status: this.isValidFailRecord(feed.failRecord || null)
        ? FeedStatus.FAILED
        : FeedStatus.OK,
      failReason: feed.failRecord?.reason,
      refreshRateSeconds: 10,
    }));

    withStatuses.forEach((feed) => {
      delete feed.failRecord;
    });

    return withStatuses;
  }

  /**
   * See if a fail record should be valid and eligible for a refresh. If a fail record is invalid,
   * then it's still on cycle.
   *
   * @param failRecord The fail record to check
   * @param requiredLifetimeHours How long the fail record should be in the database to consider
   *  feeds as failures. Hardcoded as 18 for now to match the config until a separate service is
   *  ready to handle fail records.
   * @returns
   */
  private isValidFailRecord(
    failRecord: FailRecord | null,
    requiredLifetimeHours = 18,
  ) {
    if (!failRecord) {
      return false;
    }

    const hoursDiff = dayjs().diff(dayjs(failRecord.failedAt), 'hours');

    return hoursDiff >= requiredLifetimeHours;
  }
}

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Feed, FeedDocument, FeedModel } from './entities/Feed.entity';
import { DetailedFeed } from './types/detailed-feed.type';
import { Types, FilterQuery } from 'mongoose';
import _ from 'lodash';
import { FailRecord, FailRecordModel } from './entities/fail-record.entity';
import { FeedStatus } from './types/FeedStatus.type';
import dayjs from 'dayjs';
import { FeedSchedulingService } from './feed-scheduling.service';

interface UpdateFeedInput {
  title?: string;
  text?: string;
  filters?: Record<string, string[]>;
  checkTitles?: boolean;
  checkDates?: boolean;
  imgPreviews?: boolean;
  imgLinksExistence?: boolean;
  formatTables?: boolean;
  splitMessage?: boolean;
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
    private readonly feedSchedulingService: FeedSchedulingService,
  ) {}

  async getFeed(feedId: string): Promise<DetailedFeed | null> {
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
      search?: string;
      limit: number;
      offset: number;
    },
  ): Promise<DetailedFeed[]> {
    const feeds = await this.findFeeds(
      {
        guild: serverId,
      },
      {
        search: options.search,
        limit: options.limit,
        skip: options.offset,
      },
    );

    return feeds;
  }

  async countServerFeeds(
    serverId: string,
    options?: {
      search?: string;
    },
  ): Promise<number> {
    const query: FilterQuery<Feed> = {
      guild: serverId,
    };

    if (options?.search) {
      query.$or = [
        {
          title: new RegExp(_.escapeRegExp(options.search), 'i'),
        },
        {
          url: new RegExp(_.escapeRegExp(options.search), 'i'),
        },
      ];
    }

    return this.feedModel.countDocuments(query);
  }

  async updateOne(
    feedId: string | Types.ObjectId,
    input: UpdateFeedInput,
  ): Promise<DetailedFeed> {
    const strippedUpdateObject: UpdateFeedInput = _.omitBy(
      input,
      _.isUndefined,
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateObject: Record<string, any> = {
      $set: {},
      $unset: {},
    };

    if (strippedUpdateObject.text != null) {
      updateObject.$set.text = strippedUpdateObject.text;
    }

    if (strippedUpdateObject.webhook?.id != null) {
      if (!strippedUpdateObject.webhook?.id) {
        updateObject.$unset.webhook = '';
      } else {
        updateObject.$set.webhook = {
          id: strippedUpdateObject.webhook.id,
        };
      }
    }

    if (strippedUpdateObject.filters) {
      updateObject.$set.filters = strippedUpdateObject.filters;
    }

    if (strippedUpdateObject.title) {
      updateObject.$set.title = strippedUpdateObject.title;
    }

    if (strippedUpdateObject.checkTitles != null) {
      updateObject.$set.checkTitles = strippedUpdateObject.checkTitles;
    }

    if (strippedUpdateObject.checkDates != null) {
      updateObject.$set.checkDates = strippedUpdateObject.checkDates;
    }

    if (strippedUpdateObject.imgPreviews != null) {
      updateObject.$set.imgPreviews = strippedUpdateObject.imgPreviews;
    }

    if (strippedUpdateObject.imgLinksExistence != null) {
      updateObject.$set.imgLinksExistence =
        strippedUpdateObject.imgLinksExistence;
    }

    if (strippedUpdateObject.formatTables != null) {
      updateObject.$set.formatTables = strippedUpdateObject.formatTables;
    }

    if (strippedUpdateObject.splitMessage != null) {
      updateObject.$set.split = {
        enabled: strippedUpdateObject.splitMessage,
      };
    }

    await this.feedModel.updateOne(
      {
        _id: feedId,
      },
      updateObject,
    );

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

  async refresh(feedId: string | Types.ObjectId): Promise<DetailedFeed> {
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
      search?: string;
      limit: number;
      skip: number;
    },
  ): Promise<DetailedFeed[]> {
    const match = {
      ...filter,
    };

    if (options.search) {
      match.$or = [
        {
          title: new RegExp(_.escapeRegExp(options.search), 'i'),
        },
        {
          url: new RegExp(_.escapeRegExp(options.search), 'i'),
        },
      ];
    }

    const feeds: PopulatedFeed[] = await this.feedModel.aggregate([
      {
        $match: match,
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

    const refreshRates =
      await this.feedSchedulingService.getRefreshRatesOfFeeds(
        feeds.map((feed) => ({
          _id: feed._id.toHexString(),
          guild: feed.guild,
          url: feed.url,
        })),
      );

    const withStatuses = feeds.map((feed, index) => ({
      ...feed,
      status: this.isValidFailRecord(feed.failRecord || null)
        ? FeedStatus.FAILED
        : FeedStatus.OK,
      failReason: feed.failRecord?.reason,
      refreshRateSeconds: refreshRates[index],
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

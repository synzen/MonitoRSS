import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Feed, FeedDocument, FeedModel } from './entities/feed.entity';
import { DetailedFeed } from './types/detailed-feed.type';
import { Types, FilterQuery } from 'mongoose';
import _ from 'lodash';
import { FailRecord, FailRecordModel } from './entities/fail-record.entity';
import { FeedStatus } from './types/FeedStatus.type';
import dayjs from 'dayjs';
import { FeedSchedulingService } from './feed-scheduling.service';
import { DiscordAPIService } from '../../services/apis/discord/discord-api.service';
import { ConfigService } from '@nestjs/config';
import { CloneFeedInputProperties } from './dto/CloneFeedInput.dto';
import {
  FeedSubscriber,
  FeedSubscriberModel,
} from './entities/feed-subscriber.entity';

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
  channelId?: string;
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
    @InjectModel(FeedSubscriber.name)
    private readonly feedSubscriberModel: FeedSubscriberModel,
    private readonly feedSchedulingService: FeedSchedulingService,
    private readonly discordApiService: DiscordAPIService,
    private readonly configService: ConfigService,
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

    if (strippedUpdateObject.channelId) {
      updateObject.$set.channel = strippedUpdateObject.channelId;
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

  async allFeedsBelongToGuild(feedIds: string[], guildId: string) {
    const foundCount = await this.feedModel.countDocuments({
      _id: {
        $in: feedIds.map((id) => new Types.ObjectId(id)),
      },
      guild: guildId,
    });

    return foundCount === feedIds.length;
  }

  async cloneFeed(
    sourceFeed: Feed,
    targetFeedIds: string[],
    properties: CloneFeedInputProperties[],
  ) {
    const propertyMap: Partial<
      Record<CloneFeedInputProperties, (keyof Feed)[]>
    > = {
      COMPARISONS: ['ncomparisons', 'pcomparisons'],
      FILTERS: ['filters', 'rfilters'],
      MESSAGE: ['text', 'embeds'],
      MISC_OPTIONS: [
        'checkDates',
        'checkTitles',
        'imgPreviews',
        'imgLinksExistence',
        'formatTables',
        'split',
      ],
      WEBHOOK: ['webhook'],
      REGEXOPS: ['regexOps'],
    };

    const toUpdate = {
      $set: {} as Record<keyof Feed, unknown>,
    };

    for (const property of properties) {
      const propertyKeys = propertyMap[property];

      if (propertyKeys) {
        for (const key of propertyKeys) {
          toUpdate.$set[key] = sourceFeed[key];
        }
      }
    }

    if (properties.includes(CloneFeedInputProperties.SUBSCRIBERS)) {
      await this.cloneSubscribers(sourceFeed._id.toHexString(), targetFeedIds);
    }

    await this.feedModel.updateMany(
      {
        _id: {
          $in: targetFeedIds.map((id) => new Types.ObjectId(id)),
        },
      },
      toUpdate,
    );

    const foundFeeds = await this.findFeeds(
      {
        _id: {
          $in: targetFeedIds.map((id) => new Types.ObjectId(id)),
        },
      },
      {
        limit: targetFeedIds.length,
        skip: 0,
      },
    );

    return foundFeeds;
  }

  private async cloneSubscribers(
    sourceFeedId: string,
    targetFeedIds: string[],
  ) {
    const subscribers: FeedSubscriber[] = await this.feedSubscriberModel
      .find({
        feed: new Types.ObjectId(sourceFeedId),
      })
      .lean();

    const toInsert = targetFeedIds
      .map((targetFeedId) => {
        return subscribers.map((subscriber) => ({
          ...subscriber,
          _id: new Types.ObjectId(),
          feed: new Types.ObjectId(targetFeedId),
        }));
      })
      .flat();

    // Ideally this should use transactions, but tests are not set up for it yet

    await this.feedSubscriberModel.deleteMany({
      feed: {
        $in: targetFeedIds.map((id) => new Types.ObjectId(id)),
      },
    });

    await this.feedSubscriberModel.insertMany(toInsert);
  }

  // async boHasSendMessageChannelPerms({
  //   guildId,
  //   channelId,
  // }: {
  //   guildId: string;
  //   channelId: string;
  // }) {
  //   // TODO: Better error handling here for permissions
  //   const botUserId = this.configService.get('discordClientId') as string;

  //   try {
  //     await Promise.all([
  //       this.discordApiService.executeBotRequest(
  //         `/guilds/${guildId}/members/${botUserId}`,
  //       ),
  //       this.discordApiService.executeBotRequest(`/channels/${channelId}`),
  //     ]);

  //     return true;
  //   } catch (err) {
  //     console.error(err);

  //     return false;
  //   }
  // }

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

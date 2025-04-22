import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Feed, FeedDocument, FeedModel } from "./entities/feed.entity";
import { DetailedFeed } from "./types/detailed-feed.type";
import { Types, FilterQuery } from "mongoose";
import _ from "lodash";
import { FailRecord, FailRecordModel } from "./entities/fail-record.entity";
import { FeedStatus } from "./types/FeedStatus.type";
import dayjs from "dayjs";
import { FeedSchedulingService } from "./feed-scheduling.service";
import { DiscordAPIService } from "../../services/apis/discord/discord-api.service";
import { ConfigService } from "@nestjs/config";
import { CloneFeedInputProperties } from "./dto/CloneFeedInput.dto";
import {
  FeedSubscriber,
  FeedSubscriberModel,
} from "./entities/feed-subscriber.entity";
import { FeedFetcherService } from "../../services/feed-fetcher/feed-fetcher.service";
import logger from "../../utils/logger";
import { DiscordAuthService } from "../discord-auth/discord-auth.service";
import { DiscordAPIError } from "../../common/errors/DiscordAPIError";
import {
  BannedFeedException,
  FeedLimitReachedException,
  MissingChannelException,
  MissingChannelPermissionsException,
  NoDiscordChannelPermissionOverwritesException,
  UserMissingManageGuildException,
} from "./exceptions";
import { SupportersService } from "../supporters/supporters.service";
import { BannedFeed, BannedFeedModel } from "./entities/banned-feed.entity";
import { DiscordChannelType, DiscordGuildChannel } from "../../common";
import { DiscordPermissionsService } from "../discord-auth/discord-permissions.service";
import {
  SEND_CHANNEL_MESSAGE,
  VIEW_CHANNEL,
} from "../discord-auth/constants/permissions";
import {
  FeedFilteredFormat,
  FeedFilteredFormatModel,
} from "./entities/feed-filtered-format.entity";

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
  embeds?: Feed["embeds"];
  webhook?: {
    id?: string;
    name?: string;
    iconUrl?: string;
    token?: string;
  };
  ncomparisons?: string[];
  pcomparisons?: string[];
}
interface PopulatedFeed extends Feed {
  failRecord?: FailRecord;
}

@Injectable()
export class FeedsService {
  constructor(
    @InjectModel(Feed.name) private readonly feedModel: FeedModel,
    @InjectModel(FailRecord.name) private readonly failRecord: FailRecordModel,
    @InjectModel(BannedFeed.name)
    private readonly bannedFeedModel: BannedFeedModel,
    @InjectModel(FeedSubscriber.name)
    private readonly feedSubscriberModel: FeedSubscriberModel,
    @InjectModel(FeedFilteredFormat.name)
    private readonly feedFilteredFormatModel: FeedFilteredFormatModel,
    private readonly feedSchedulingService: FeedSchedulingService,
    private readonly feedFetcherSevice: FeedFetcherService,
    private readonly discordApiService: DiscordAPIService,
    private readonly configService: ConfigService,
    private readonly discordAuthService: DiscordAuthService,
    private readonly supportersService: SupportersService,
    private readonly discordPermissionsService: DiscordPermissionsService
  ) {}

  async addFeed(
    userAccessToken: string,
    {
      title,
      url,
      channelId,
      isFeedV2,
    }: {
      title: string;
      url: string;
      channelId: string;
      isFeedV2: boolean;
    }
  ) {
    let channel: DiscordGuildChannel;

    try {
      channel = await this.canUseChannel({
        channelId,
        userAccessToken,
      });
    } catch (err) {
      if (err instanceof DiscordAPIError) {
        if (err.statusCode === HttpStatus.NOT_FOUND) {
          throw new MissingChannelException();
        }

        if (err.statusCode === HttpStatus.FORBIDDEN) {
          throw new MissingChannelPermissionsException();
        }
      }

      throw err;
    }

    const remainingAvailableFeeds = await this.getRemainingFeedLimitCount(
      channel.guild_id
    );

    if (remainingAvailableFeeds <= 0) {
      throw new FeedLimitReachedException();
    }

    await this.feedFetcherSevice.fetchFeed(url, null, {
      fetchOptions: {
        useServiceApi: isFeedV2,
        useServiceApiCache: false,
      },
    });

    const bannedRecord = await this.getBannedFeedDetails(url, channel.guild_id);

    if (bannedRecord) {
      throw new BannedFeedException();
    }

    const created = await this.feedModel.create({
      title,
      url,
      channel: channelId,
      guild: channel.guild_id,
    });

    const withDetails = await this.findFeeds(
      {
        _id: created._id,
      },
      {
        limit: 1,
        skip: 0,
      }
    );

    return withDetails[0];
  }

  async enableFeed(feedId: string) {
    await this.feedModel.updateOne(
      {
        _id: feedId,
      },
      {
        $unset: {
          disabled: "",
        },
      }
    );
  }

  async canUseChannel({
    channelId,
    userAccessToken,
    skipBotPermissionAssertions,
  }: {
    channelId: string;
    userAccessToken: string;
    skipBotPermissionAssertions?: boolean;
  }) {
    const channel = await this.discordApiService.getChannel(channelId);

    const userManagesGuild = await this.discordAuthService.userManagesGuild(
      userAccessToken,
      channel.guild_id
    );

    if (!userManagesGuild) {
      throw new UserMissingManageGuildException();
    }

    if (channel.type === DiscordChannelType.PUBLIC_THREAD) {
      return channel;
    }

    if (!channel.permission_overwrites) {
      throw new NoDiscordChannelPermissionOverwritesException();
    }

    if (
      !skipBotPermissionAssertions &&
      !(await this.discordPermissionsService.botHasPermissionInChannel(
        channel,
        [SEND_CHANNEL_MESSAGE, VIEW_CHANNEL]
      ))
    ) {
      throw new MissingChannelPermissionsException();
    }

    return channel;
  }

  async removeFeed(feedId: string) {
    const feedIdObjectId = new Types.ObjectId(feedId);
    await Promise.all([
      this.feedModel.deleteOne({
        _id: feedIdObjectId,
      }),
      this.feedSubscriberModel.deleteMany({
        feed: feedIdObjectId,
      }),
      this.feedFilteredFormatModel.deleteMany({
        feed: feedIdObjectId,
      }),
    ]);
  }

  async getFeed(feedId: string): Promise<DetailedFeed | null> {
    const feeds = await this.findFeeds(
      {
        _id: new Types.ObjectId(feedId),
      },
      {
        limit: 1,
        skip: 0,
      }
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
    }
  ): Promise<DetailedFeed[]> {
    const feeds = await this.findFeeds(
      {
        guild: serverId,
      },
      {
        search: options.search,
        limit: options.limit,
        skip: options.offset,
      }
    );

    return feeds;
  }

  async countServerFeeds(
    serverId: string,
    options?: {
      search?: string;
    }
  ): Promise<number> {
    const query: FilterQuery<Feed> = {
      guild: serverId,
    };

    if (options?.search) {
      query.$or = [
        {
          title: new RegExp(_.escapeRegExp(options.search), "i"),
        },
        {
          url: new RegExp(_.escapeRegExp(options.search), "i"),
        },
      ];
    }

    return this.feedModel.countDocuments(query);
  }

  async countLegacyServerFeeds(serverId: string): Promise<number> {
    const query: FilterQuery<Feed> = {
      guild: serverId,
      disabled: {
        $ne: "CONVERTED_USER_FEED",
      },
    };

    return this.feedModel.countDocuments(query);
  }

  async updateOne(
    feedId: string | Types.ObjectId,
    input: UpdateFeedInput
  ): Promise<DetailedFeed> {
    const existingFeed = await this.feedModel.findById(feedId).lean();

    if (!existingFeed) {
      throw new Error(`Feed ${feedId} not found while attempting to update`);
    }

    const strippedUpdateObject: UpdateFeedInput = _.omitBy(
      input,
      _.isUndefined
    );

    const webhookUpdates = this.getUpdateWebhookObject(
      existingFeed.webhook,
      input
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateObject: Record<string, any> = {
      $set: {
        ...webhookUpdates.$set,
      },
      $unset: {
        ...webhookUpdates.$unset,
      },
    };

    if (strippedUpdateObject.text != null) {
      updateObject.$set.text = strippedUpdateObject.text;
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

    if (strippedUpdateObject.ncomparisons) {
      updateObject.$set.ncomparisons = strippedUpdateObject.ncomparisons;
    }

    if (strippedUpdateObject.pcomparisons) {
      updateObject.$set.pcomparisons = strippedUpdateObject.pcomparisons;
    }

    const cleanedEmbeds = strippedUpdateObject.embeds
      ?.map((obj) => _.omitBy(obj, _.isUndefined))
      .filter((obj) => Object.keys(obj).length > 0);

    if (Array.isArray(cleanedEmbeds)) {
      updateObject.$set.embeds = cleanedEmbeds;
    }

    if (strippedUpdateObject.channelId) {
      await this.checkFeedGuildChannelIsValid(
        existingFeed.guild,
        strippedUpdateObject.channelId
      );
      updateObject.$set.channel = strippedUpdateObject.channelId;
    }

    await this.feedModel.updateOne(
      {
        _id: feedId,
      },
      updateObject
    );

    const foundFeeds = await this.findFeeds(
      {
        _id: new Types.ObjectId(feedId),
      },
      {
        limit: 1,
        skip: 0,
      }
    );

    return foundFeeds[0];
  }

  async refresh(feedId: string | Types.ObjectId): Promise<DetailedFeed> {
    const feed = await this.feedModel.findById(feedId).lean();

    if (!feed) {
      throw new Error(`Feed ${feedId} does not exist`);
    }

    if (!feed.isFeedv2) {
      throw new Error(`Feed ${feedId} must be converted to a personal feed`);
    }

    await this.feedFetcherSevice.fetchFeed(feed.url, null, {
      fetchOptions: {
        useServiceApi: true,
        useServiceApiCache: false,
      },
    });

    await this.failRecord.deleteOne({ _id: feed.url });

    const feeds = await this.findFeeds(
      {
        _id: new Types.ObjectId(feedId),
      },
      {
        limit: 1,
        skip: 0,
      }
    );

    return feeds[0];
  }

  async findFeeds(
    filter: FilterQuery<FeedDocument>,
    options: {
      search?: string;
      limit: number;
      skip: number;
    }
  ): Promise<DetailedFeed[]> {
    const match = {
      ...filter,
    };

    if (options.search) {
      match.$or = [
        {
          title: new RegExp(_.escapeRegExp(options.search), "i"),
        },
        {
          url: new RegExp(_.escapeRegExp(options.search), "i"),
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
          from: "fail_records",
          localField: "url",
          foreignField: "_id",
          as: "failRecord",
        },
      },
      {
        $addFields: {
          failRecord: {
            $first: "$failRecord",
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
        }))
      );

    const withStatuses = feeds.map((feed, index) => {
      let feedStatus: FeedStatus;

      if (this.isValidFailRecord(feed.failRecord || null)) {
        feedStatus = FeedStatus.FAILED;
      } else if (feed.failRecord) {
        feedStatus = FeedStatus.FAILING;
      } else if (feed.disabled === "CONVERTED_USER_FEED") {
        feedStatus = FeedStatus.CONVERTED_TO_USER;
      } else if (feed.disabled) {
        feedStatus = FeedStatus.DISABLED;
      } else {
        feedStatus = FeedStatus.OK;
      }

      let disabledReason = feed.disabled;

      if (feed.disabled === "DISABLED_FOR_PERSONAL_ROLLOUT") {
        disabledReason =
          "Deprecated for personal feeds. Must convert to personal feed to restore function.";
      }

      return {
        ...feed,
        status: feedStatus,
        failReason: feed.failRecord?.reason,
        disabledReason,
        refreshRateSeconds: refreshRates[index],
      };
    });

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
    properties: CloneFeedInputProperties[]
  ) {
    const propertyMap: Partial<
      Record<CloneFeedInputProperties, (keyof Feed)[]>
    > = {
      COMPARISONS: ["ncomparisons", "pcomparisons"],
      FILTERS: ["filters", "rfilters"],
      MESSAGE: ["text", "embeds"],
      MISC_OPTIONS: [
        "checkDates",
        "checkTitles",
        "imgPreviews",
        "imgLinksExistence",
        "formatTables",
        "split",
      ],
      WEBHOOK: ["webhook"],
      REGEXOPS: ["regexOps"],
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
      toUpdate
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
      }
    );

    return foundFeeds;
  }

  async getBannedFeedDetails(url: string, guildId: string) {
    return this.bannedFeedModel.findOne({
      url: url,
      $or: [
        {
          guildIds: guildId,
        },
        {
          guildIds: {
            $size: 0,
          },
        },
      ],
    });
  }

  private async checkFeedGuildChannelIsValid(
    guildId: string,
    channelId: string
  ) {
    let channel: DiscordGuildChannel;

    try {
      channel = await this.discordApiService.getChannel(channelId);
    } catch (err) {
      logger.info(
        `Skipped updating feed channel because failed to get channel`,
        {
          stack: err.stack,
        }
      );

      if (err instanceof DiscordAPIError) {
        if (err.statusCode === HttpStatus.NOT_FOUND) {
          throw new MissingChannelException();
        }

        if (err.statusCode === HttpStatus.FORBIDDEN) {
          throw new MissingChannelPermissionsException();
        }
      }

      throw err;
    }

    if (channel.guild_id !== guildId) {
      throw new MissingChannelPermissionsException();
    }

    const hasPermissionInChannel =
      await this.discordPermissionsService.botHasPermissionInChannel(channel, [
        VIEW_CHANNEL,
        SEND_CHANNEL_MESSAGE,
      ]);

    if (!hasPermissionInChannel) {
      throw new MissingChannelPermissionsException();
    }
  }

  private getUpdateWebhookObject(
    existingFeedWebhook: Feed["webhook"],
    updateObject: UpdateFeedInput
  ) {
    if (updateObject.webhook?.id === "") {
      return {
        $set: {},
        $unset: {
          webhook: "",
        },
      };
    }

    const toSet = {
      $set: {
        webhook: {} as Record<string, unknown>,
      },
      $unset: {},
    };

    if (typeof updateObject.webhook?.id === "string") {
      toSet.$set.webhook.id = updateObject.webhook.id;

      if (typeof updateObject.webhook?.token === "string") {
        toSet.$set.webhook.url =
          `https://discord.com/api/v9/webhooks/${updateObject.webhook.id}` +
          `/${updateObject.webhook.token}`;
      }
    }

    if (typeof updateObject.webhook?.name === "string") {
      toSet.$set.webhook.name = updateObject.webhook.name;
    }

    if (typeof updateObject.webhook?.iconUrl === "string") {
      toSet.$set.webhook.avatar = updateObject.webhook.iconUrl;
    }

    if (Object.keys(toSet.$set.webhook).length === 0) {
      return {
        $set: {},
        $unset: {},
      };
    }

    toSet.$set.webhook = {
      ...(existingFeedWebhook || {}),
      ...toSet.$set.webhook,
    };

    return toSet;
  }

  private async getRemainingFeedLimitCount(guildId: string) {
    const [benefits] = await this.supportersService.getBenefitsOfServers([
      guildId,
    ]);

    const currentTotalFeeds = await this.feedModel.countDocuments({
      guild: guildId,
    });

    return benefits.maxFeeds - currentTotalFeeds;
  }

  private async cloneSubscribers(
    sourceFeedId: string,
    targetFeedIds: string[]
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
    requiredLifetimeHours = 18
  ) {
    if (!failRecord) {
      return false;
    }

    const hoursDiff = dayjs().diff(dayjs(failRecord.failedAt), "hours");

    return hoursDiff >= requiredLifetimeHours;
  }
}

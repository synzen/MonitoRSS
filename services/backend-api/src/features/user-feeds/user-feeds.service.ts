/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable max-len */
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FeedFetcherService } from "../../services/feed-fetcher/feed-fetcher.service";
import {
  BannedFeedException,
  FeedLimitReachedException,
} from "../feeds/exceptions";
import { FeedsService } from "../feeds/feeds.service";
import { UserFeed, UserFeedDocument, UserFeedModel } from "./entities";
import _, { chunk } from "lodash";
import { SupportersService } from "../supporters/supporters.service";
import {
  GetFeedArticlePropertiesInput,
  GetFeedArticlePropertiesOutput,
  GetFeedArticlesInput,
  GetFeedArticlesOutput,
  UserFeedDisabledCode,
  UserFeedHealthStatus,
} from "./types";
import { FeedNotFailedException } from "./exceptions/feed-not-failed.exception";
import { FeedHandlerService } from "../../services/feed-handler/feed-handler.service";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { MessageBrokerQueue } from "../../common/constants/message-broker-queue.constants";
import { FeedFetcherApiService } from "../../services/feed-fetcher/feed-fetcher-api.service";
import { GetArticlesInput } from "../../services/feed-handler/types";
import logger from "../../utils/logger";
import { FilterQuery, PipelineStage, Types, UpdateQuery } from "mongoose";
import { GetUserFeedsInputDto, GetUserFeedsInputSortKey } from "./dto";
import {
  FeedConnectionDisabledCode,
  FeedConnectionType,
  FeedConnectionTypeEntityKey,
} from "../feeds/constants";
import { UserFeedComputedStatus } from "./constants/user-feed-computed-status.type";
import { Feed, FeedModel } from "../feeds/entities/feed.entity";
import {
  UserFeedLimitOverride,
  UserFeedLimitOverrideModel,
} from "../supporters/entities/user-feed-limit-overrides.entity";
import {
  IneligibleForRestorationException,
  ManualRequestTooSoonException,
} from "./exceptions";
import {
  LegacyFeedConversionJob,
  LegacyFeedConversionJobModel,
} from "../legacy-feed-conversion/entities/legacy-feed-conversion-job.entity";
import { UserFeedManagerStatus } from "../user-feed-management-invites/constants";
import { FeedConnectionsDiscordChannelsService } from "../feed-connections/feed-connections-discord-channels.service";
import dayjs from "dayjs";
import { User, UserModel } from "../users/entities/user.entity";
import { FeedFetcherFetchStatus } from "../../services/feed-fetcher/types";
import { CreateDiscordChannelConnectionOutputDto } from "../feed-connections/dto";
import { convertToNestedDiscordEmbed } from "../../utils/convert-to-nested-discord-embed";
import { CustomPlaceholderStepType } from "../../common/constants/custom-placeholder-step-type.constants";

const badConnectionCodes = Object.values(FeedConnectionDisabledCode).filter(
  (c) => c !== FeedConnectionDisabledCode.Manual
);
const badUserFeedCodes = Object.values(UserFeedDisabledCode).filter(
  (c) => c !== UserFeedDisabledCode.Manual
);
const feedConnectionTypeKeys = Object.values(FeedConnectionTypeEntityKey);

interface UpdateFeedInput {
  title?: string;
  url?: string;
  disabledCode?: UserFeedDisabledCode | null;
  passingComparisons?: string[];
  blockingComparisons?: string[];
  formatOptions?: Partial<UserFeed["formatOptions"]>;
  dateCheckOptions?: Partial<UserFeed["dateCheckOptions"]>;
  shareManageOptions?: {
    invites: Array<{ discordUserId: string }>;
  };
  userRefreshRateSeconds?: number;
  externalProperties?: UserFeed["externalProperties"];
}

@Injectable()
export class UserFeedsService {
  constructor(
    @InjectModel(UserFeed.name) private readonly userFeedModel: UserFeedModel,
    @InjectModel(Feed.name) private readonly feedModel: FeedModel,
    @InjectModel(UserFeedLimitOverride.name)
    private readonly limitOverrideModel: UserFeedLimitOverrideModel,
    @InjectModel(LegacyFeedConversionJob.name)
    private readonly legacyFeedConversionJobModel: LegacyFeedConversionJobModel,
    @InjectModel(User.name) private readonly userModel: UserModel,
    private readonly feedsService: FeedsService,
    private readonly feedFetcherService: FeedFetcherService,
    private readonly supportersService: SupportersService,
    private readonly feedHandlerService: FeedHandlerService,
    private readonly feedFetcherApiService: FeedFetcherApiService,
    private readonly amqpConnection: AmqpConnection,
    private readonly feedConnectionsDiscordChannelsService: FeedConnectionsDiscordChannelsService
  ) {}

  async formatForHttpResponse(feed: UserFeed, discordUserId: string) {
    const discordChannelConnections: CreateDiscordChannelConnectionOutputDto[] =
      feed.connections.discordChannels.map((con) => ({
        id: con.id.toHexString(),
        name: con.name,
        key: FeedConnectionType.DiscordChannel,
        details: {
          ...con.details,
          embeds: convertToNestedDiscordEmbed(con.details.embeds),
          webhook: con.details.webhook
            ? {
                id: con.details.webhook.id,
                guildId: con.details.webhook.guildId,
                iconUrl: con.details.webhook.iconUrl,
                name: con.details.webhook.name,
                type: con.details.webhook.type,
                threadId: con.details.webhook.threadId,
                isApplicationOwned: con.details.webhook.isApplicationOwned,
                channelId: con.details.webhook.channelId,
              }
            : undefined,
        },
        filters: con.filters,
        rateLimits: con.rateLimits,
        disabledCode: con.disabledCode,
        splitOptions: con.splitOptions,
        mentions: con.mentions,
        customPlaceholders: con.customPlaceholders?.map((c) => ({
          ...c,
          steps: c.steps.map((s) => {
            if (s.type === CustomPlaceholderStepType.Regex) {
              return {
                ...s,
                regexSearchFlags: s.regexSearchFlags || "gmi", // default is set in user-feeds-service
              };
            } else {
              return s;
            }
          }),
        })),
      }));

    const isOwner = feed.user.discordUserId === discordUserId;

    const userInviteId = feed.shareManageOptions?.invites?.find(
      (u) =>
        u.discordUserId === discordUserId &&
        u.status === UserFeedManagerStatus.Accepted
    )?.id;

    const refreshRateOptions: Array<{
      rateSeconds: number;
      disabledCode?: string;
    }> = [
      {
        rateSeconds: this.supportersService.defaultRefreshRateSeconds,
      },
      {
        rateSeconds: this.supportersService.defaultRefreshRateSeconds * 6,
      },
    ];

    if (await this.supportersService.areSupportersEnabled()) {
      const feedOwnerBenefits =
        await this.supportersService.getBenefitsOfDiscordUser(
          feed.user.discordUserId
        );

      refreshRateOptions.unshift({
        rateSeconds: this.supportersService.defaultSupporterRefreshRateSeconds,
        disabledCode:
          feedOwnerBenefits.refreshRateSeconds >=
          this.supportersService.defaultRefreshRateSeconds
            ? "INSUFFICIENT_SUPPORTER_TIER"
            : undefined,
      });
    }

    return {
      result: {
        id: feed._id.toHexString(),
        allowLegacyReversion: feed.allowLegacyReversion,
        sharedAccessDetails: userInviteId
          ? {
              inviteId: userInviteId.toHexString(),
            }
          : undefined,
        title: feed.title,
        url: feed.url,
        isLegacyFeed: !!feed.legacyFeedId,
        connections: [...discordChannelConnections],
        disabledCode: feed.disabledCode,
        healthStatus: feed.healthStatus,
        passingComparisons: feed.passingComparisons,
        blockingComparisons: feed.blockingComparisons,
        externalProperties: feed.externalProperties,
        createdAt: feed.createdAt.toISOString(),
        updatedAt: feed.updatedAt.toISOString(),
        formatOptions: feed.formatOptions,
        dateCheckOptions: feed.dateCheckOptions,
        refreshRateSeconds:
          feed.refreshRateSeconds ||
          (
            await this.supportersService.getBenefitsOfDiscordUser(
              feed.user.discordUserId
            )
          ).refreshRateSeconds,
        userRefreshRateSeconds: feed.userRefreshRateSeconds,
        shareManageOptions: isOwner ? feed.shareManageOptions : undefined,
        refreshRateOptions,
      },
    };
  }

  async restoreToLegacyFeed(userFeed: UserFeed) {
    if (!userFeed.legacyFeedId) {
      throw new IneligibleForRestorationException(
        `User feed ${userFeed._id} is not related to a legacy feed for restoration`
      );
    }

    if (userFeed.disabledCode === UserFeedDisabledCode.ExcessivelyActive) {
      throw new IneligibleForRestorationException(
        `User feed ${userFeed._id} is excessively active and cannot be restored`
      );
    }

    await this.feedModel.updateOne(
      {
        _id: userFeed.legacyFeedId,
      },
      {
        $unset: {
          disabled: "",
        },
      }
    );

    await this.userFeedModel.deleteOne({
      _id: userFeed._id,
    });

    await this.limitOverrideModel.updateOne(
      {
        _id: userFeed.user.discordUserId,
      },
      {
        $inc: {
          additionalUserFeeds: -1,
        },
      }
    );

    await this.legacyFeedConversionJobModel.deleteOne({
      legacyFeedId: userFeed.legacyFeedId,
    });
  }

  getDatePreview({
    dateFormat,
    dateLocale,
    dateTimezone,
  }: {
    dateFormat?: string;
    dateTimezone?: string;
    dateLocale?: string;
  }) {
    try {
      return {
        output: dayjs()
          .tz(dateTimezone || "UTC")
          .locale(dateLocale || "en")
          .format(dateFormat || undefined),
        valid: true,
      };
    } catch (err) {
      return {
        valid: false,
      };
    }
  }

  async addFeed(
    {
      discordUserId,
    }: {
      discordUserId: string;
    },
    {
      title,
      url,
    }: {
      title: string;
      url: string;
    }
  ) {
    const { maxUserFeeds, maxDailyArticles, refreshRateSeconds } =
      await this.supportersService.getBenefitsOfDiscordUser(discordUserId);

    const feedCount = await this.calculateCurrentFeedCountOfDiscordUser(
      discordUserId
    );

    if (feedCount >= maxUserFeeds) {
      throw new FeedLimitReachedException("Max feeds reached");
    }

    await this.checkUrlIsValid(url);

    const created = await this.userFeedModel.create({
      title,
      url,
      user: {
        discordUserId,
      },
      refreshRateSeconds,
      maxDailyArticles,
    });

    return created;
  }

  async clone(
    feedId: string,
    userAccessToken: string,
    data?: {
      title?: string;
      url?: string;
    }
  ) {
    const found = await this.userFeedModel.findById(feedId).lean();

    if (!found) {
      throw new Error(`Feed ${feedId} not found while cloning`);
    }

    const { maxUserFeeds } =
      await this.supportersService.getBenefitsOfDiscordUser(
        found.user.discordUserId
      );

    const feedCount = await this.calculateCurrentFeedCountOfDiscordUser(
      found.user.discordUserId
    );

    if (feedCount >= maxUserFeeds) {
      throw new FeedLimitReachedException("Max feeds reached");
    }

    const newFeedId = new Types.ObjectId();

    if (data?.url && data.url !== found.url) {
      await this.checkUrlIsValid(data.url);
    }

    const created = await this.userFeedModel.create({
      ...found,
      _id: newFeedId,
      title: data?.title || found.title,
      url: data?.url || found.url,
      connections: {},
    });

    for (const c of found.connections.discordChannels) {
      await this.feedConnectionsDiscordChannelsService.cloneConnection(
        created,
        c,
        {
          name: c.name,
        },
        userAccessToken,
        found.user.discordUserId
      );
    }

    return {
      id: newFeedId.toHexString(),
    };
  }

  async bulkDelete(feedIds: string[]) {
    const found = await this.userFeedModel
      .find({
        _id: {
          $in: feedIds.map((id) => new Types.ObjectId(id)),
        },
      })
      .select("_id legacyFeedId connections")
      .lean();

    const foundIds = new Set(found.map((doc) => doc._id.toHexString()));
    const legacyFeedIds = new Set(
      found.filter((d) => d.legacyFeedId).map((d) => d._id.toHexString())
    );

    if (found.length > 0) {
      try {
        await Promise.all(
          found.flatMap((f) =>
            f.connections.discordChannels.map(
              async (c) =>
                await this.feedConnectionsDiscordChannelsService.deleteConnection(
                  f._id.toHexString(),
                  c.id.toHexString()
                )
            )
          )
        );
      } catch (err) {
        logger.error(
          "Failed to delete connections while bulk deleting feed connections",
          {
            stack: (err as Error).stack,
          }
        );
      }

      await this.userFeedModel.deleteMany({
        _id: {
          $in: found.map((doc) => doc._id),
        },
      });
    }

    for (let i = 0; i < found.length; i++) {
      const thisId = found[i]._id.toHexString();

      this.amqpConnection.publish<{ data: { feed: { id: string } } }>(
        "",
        MessageBrokerQueue.FeedDeleted,
        { data: { feed: { id: thisId } } }
      );
    }

    return feedIds.map((id) => ({
      id,
      deleted: foundIds.has(id),
      isLegacy: legacyFeedIds.has(id),
    }));
  }

  async bulkDisable(feedIds: string[]) {
    const found = await this.userFeedModel

      .find({
        _id: {
          $in: feedIds.map((id) => new Types.ObjectId(id)),
        },
        disabledCode: {
          $exists: false,
        },
      })
      .select("_id")
      .lean();

    const foundIds = new Set(found.map((doc) => doc._id.toHexString()));

    if (found.length > 0) {
      await this.userFeedModel.updateMany(
        {
          _id: {
            $in: found.map((doc) => doc._id),
          },
        },
        {
          $set: {
            disabledCode: UserFeedDisabledCode.Manual,
          },
        }
      );
    }

    return feedIds.map((id) => ({
      id,
      disabled: foundIds.has(id),
    }));
  }

  async bulkEnable(feedIds: string[]) {
    const found = await this.userFeedModel

      .find({
        _id: {
          $in: feedIds.map((id) => new Types.ObjectId(id)),
        },
        disabledCode: UserFeedDisabledCode.Manual,
      })
      .select("_id")
      .lean();

    const foundIds = new Set(found.map((doc) => doc._id.toHexString()));

    if (found.length > 0) {
      await this.userFeedModel.updateMany(
        {
          _id: {
            $in: found.map((doc) => doc._id),
          },
        },
        {
          $unset: {
            disabledCode: "",
          },
        }
      );
    }

    return feedIds.map((id) => ({
      id,
      enabled: foundIds.has(id),
    }));
  }

  async calculateCurrentFeedCountOfDiscordUser(discordUserId: string) {
    return this.userFeedModel.countDocuments({
      $or: [
        {
          "user.discordUserId": discordUserId,
        },
        {
          "shareManageOptions.invites": {
            $elemMatch: {
              discordUserId,
              status: UserFeedManagerStatus.Accepted,
            },
          },
        },
      ],
    });
  }

  async getFeedById(id: string) {
    return this.userFeedModel.findById(id).lean();
  }

  async getFeedsByUser(
    userId: string,
    { limit = 10, offset = 0, search, sort, filters }: GetUserFeedsInputDto
  ): Promise<
    Array<{
      _id: Types.ObjectId;
      title: string;
      url: string;
      healthStatus: UserFeedHealthStatus;
      disabledCode?: UserFeedDisabledCode;
      createdAt: Date;
      computedStatus: boolean;
      legacyFeedId?: Types.ObjectId;
      ownedByUser: boolean;
    }>
  > {
    const useSort = sort || GetUserFeedsInputSortKey.CreatedAtDescending;

    const sortSplit = useSort.split("-");
    const sortDirection = useSort.startsWith("-") ? -1 : 1;
    const sortKey: string = sortSplit[sortSplit.length - 1];

    const aggregateResults = await this.userFeedModel.aggregate([
      ...this.generateGetFeedsAggregatePipeline(userId, {
        search,
        filters,
      }),
      {
        $sort: {
          [sortKey]: sortDirection,
        },
      },
      {
        $skip: offset,
      },
      {
        $limit: limit,
      },
      {
        $project: {
          _id: 1,
          title: 1,
          url: 1,
          healthStatus: 1,
          disabledCode: 1,
          createdAt: 1,
          computedStatus: 1,
          legacyFeedId: 1,
          ownedByUser: 1,
        },
      },
    ]);

    return aggregateResults;
  }

  async getFeedCountByUser(
    userId: string,
    { search, filters }: Omit<GetUserFeedsInputDto, "offset" | "limit" | "sort">
  ) {
    const aggregateResults = await this.userFeedModel.aggregate([
      ...this.generateGetFeedsAggregatePipeline(userId, {
        search,
        filters,
      }),
      {
        $count: "count",
      },
    ]);

    return aggregateResults[0]?.count || 0;
  }

  async getFeedRequests({
    skip,
    limit,
    url,
  }: {
    skip: number;
    limit: number;
    url: string;
  }) {
    return this.feedFetcherApiService.getRequests({
      limit,
      skip,
      url,
    });
  }

  async getDeliveryLogs(
    feedId: string,
    {
      limit,
      skip,
    }: {
      limit: number;
      skip: number;
    }
  ) {
    return this.feedHandlerService.getDeliveryLogs(feedId, { limit, skip });
  }

  async updateFeedById(id: string, updates: UpdateFeedInput) {
    const useUpdateObject: UpdateQuery<UserFeedDocument> = {
      $set: {},
      $unset: {
        ...(updates.disabledCode === null && {
          disabledCode: "",
        }),
      },
    };

    if (updates.title) {
      useUpdateObject.$set!.title = updates.title;
    }

    if (updates.url) {
      await this.checkUrlIsValid(updates.url);
      useUpdateObject.$set!.url = updates.url;
    }

    if (updates.disabledCode) {
      useUpdateObject.$set!.disabledCode = updates.disabledCode;
    }

    if (updates.passingComparisons) {
      useUpdateObject.$set!.passingComparisons = updates.passingComparisons;
    }

    if (updates.blockingComparisons) {
      useUpdateObject.$set!.blockingComparisons = updates.blockingComparisons;
    }

    if (updates.formatOptions) {
      useUpdateObject.$set!.formatOptions = updates.formatOptions;
    }

    if (updates.dateCheckOptions) {
      useUpdateObject.$set!.dateCheckOptions = updates.dateCheckOptions;
    }

    if (updates.shareManageOptions) {
      useUpdateObject.$set!.shareManageOptions = updates.shareManageOptions;
    }

    if (updates.externalProperties) {
      useUpdateObject.$set!.externalProperties = updates.externalProperties;
    }

    if (updates.userRefreshRateSeconds) {
      const found = await this.userFeedModel
        .findById(new Types.ObjectId(id))
        .select("user")
        .lean();

      if (!found) {
        throw new Error(`Feed ${id} not found while updating refresh rate`);
      }

      const { refreshRateSeconds: fastestPossibleRate } =
        await this.supportersService.getBenefitsOfDiscordUser(
          found.user.discordUserId
        );

      if (
        updates.userRefreshRateSeconds === null ||
        updates.userRefreshRateSeconds === fastestPossibleRate
      ) {
        useUpdateObject.$unset!.userRefreshRateSeconds = "";
      } else if (
        updates.userRefreshRateSeconds !==
          this.supportersService.defaultRefreshRateSeconds &&
        updates.userRefreshRateSeconds !==
          this.supportersService.defaultSupporterRefreshRateSeconds &&
        updates.userRefreshRateSeconds < fastestPossibleRate
      ) {
        throw new Error(
          `Refresh rate ${updates.userRefreshRateSeconds} is not allowed for user ${found.user.discordUserId}`
        );
      } else {
        useUpdateObject.$set!.userRefreshRateSeconds =
          updates.userRefreshRateSeconds;
      }
    }

    return this.userFeedModel
      .findByIdAndUpdate(id, useUpdateObject, {
        new: true,
      })
      .lean();
  }

  async deleteFeedById(id: string) {
    const found = await this.userFeedModel.findById(id).lean();

    if (!found) {
      return null;
    }

    await Promise.all(
      found.connections.discordChannels.map((c) =>
        this.feedConnectionsDiscordChannelsService.deleteConnection(
          id,
          c.id.toHexString()
        )
      )
    );

    await this.userFeedModel.deleteOne({
      _id: id,
    });

    this.amqpConnection.publish<{ data: { feed: { id: string } } }>(
      "",
      MessageBrokerQueue.FeedDeleted,
      { data: { feed: { id } } }
    );

    return found;
  }

  async retryFailedFeed(feedId: string) {
    const feed = await this.userFeedModel.findById(feedId);

    if (!feed) {
      throw new Error(
        `Feed ${feedId} not found while attempting to retry failed feed`
      );
    }

    if (
      feed.healthStatus !== UserFeedHealthStatus.Failed &&
      feed.disabledCode !== UserFeedDisabledCode.InvalidFeed
    ) {
      throw new FeedNotFailedException(
        `Feed ${feedId} is not in a failed state, cannot retry it`
      );
    }

    await this.feedFetcherService.fetchFeed(feed.url, {
      fetchOptions: {
        useServiceApi: true,
        useServiceApiCache: false,
        debug: feed.debug,
      },
    });

    return this.userFeedModel
      .findByIdAndUpdate(
        feedId,
        {
          healthStatus: UserFeedHealthStatus.Ok,
          $unset: {
            disabledCode: "",
          },
        },
        {
          new: true,
        }
      )
      .lean();
  }

  async manuallyRequest(feed: UserFeed) {
    const lastRequestTime = feed.lastManualRequestAt || new Date(0);
    const waitDurationSeconds =
      feed.userRefreshRateSeconds || feed.refreshRateSeconds || 10 * 60;
    const secondsSinceLastRequest = dayjs().diff(
      dayjs(lastRequestTime),
      "seconds"
    );

    if (secondsSinceLastRequest < waitDurationSeconds) {
      throw new ManualRequestTooSoonException(
        `Feed ${feed._id} was manually requested too soon after the last request`,
        {
          secondsUntilNextRequest:
            waitDurationSeconds - secondsSinceLastRequest,
        }
      );
    }

    const requestDate = new Date();

    const res = await this.feedFetcherApiService.fetchAndSave(feed.url, {
      getCachedResponse: false,
    });

    await this.userFeedModel
      .findByIdAndUpdate(feed._id, {
        $set: {
          lastManualRequestAt: requestDate,
        },
      })
      .lean();

    return {
      requestStatus: res.requestStatus,
      requestStatusCode:
        res.requestStatus === FeedFetcherFetchStatus.BadStatusCode
          ? res.response?.statusCode
          : undefined,
    };
  }

  async getFeedDailyLimit(feed: UserFeed) {
    const { articleRateLimits } =
      await this.supportersService.getBenefitsOfDiscordUser(
        feed.user.discordUserId
      );

    const dailyLimit = articleRateLimits.find(
      (limit) => limit.timeWindowSeconds === 86400
    );

    if (!dailyLimit) {
      throw new Error(
        `Daily limit was not found for feed ${feed._id} whose owner is ${feed.user.discordUserId}`
      );
    }

    const currentProgress = await this.feedHandlerService.getDeliveryCount({
      feedId: feed._id.toHexString(),
      timeWindowSec: 86400,
    });

    return {
      progress: currentProgress.result.count,
      max: dailyLimit?.max,
    };
  }

  async getFeedArticles({
    limit,
    url,
    random,
    filters,
    selectProperties,
    selectPropertyTypes,
    skip,
    formatter,
    discordUserId,
  }: GetFeedArticlesInput): Promise<GetFeedArticlesOutput> {
    const user = await this.userModel.findOne(
      {
        discordUserId,
      },
      {
        preferences: 1,
      }
    );

    return this.feedHandlerService.getArticles({
      url,
      limit,
      random,
      filters,
      skip: skip || 0,
      selectProperties,
      selectPropertyTypes,
      formatter: {
        ...formatter,
        options: {
          ...formatter?.options,
          dateFormat:
            formatter.options.dateFormat || user?.preferences?.dateFormat,
          dateTimezone:
            formatter.options.dateTimezone || user?.preferences?.dateTimezone,
          dateLocale:
            formatter.options.dateLocale || user?.preferences?.dateLocale,
        },
      },
    });
  }

  async getFeedArticleProperties({
    url,
    customPlaceholders,
  }: GetFeedArticlePropertiesInput): Promise<GetFeedArticlePropertiesOutput> {
    const input: GetArticlesInput = {
      url,
      limit: 10,
      random: false,
      skip: 0,
      selectProperties: ["*"],
      formatter: {
        options: {
          formatTables: false,
          stripImages: false,
          dateFormat: undefined,
          dateTimezone: undefined,
          disableImageLinkPreviews: false,
          dateLocale: undefined,
        },
        customPlaceholders,
      },
    };

    const { articles, requestStatus } =
      await this.feedHandlerService.getArticles(input);

    const properties = Array.from(
      new Set(articles.map((article) => Object.keys(article)).flat())
    ).sort();

    return {
      requestStatus,
      properties,
    };
  }

  private generateGetFeedsAggregatePipeline(
    userId: string,
    {
      search,
      filters,
    }: {
      search?: string;
      filters?: GetUserFeedsInputDto["filters"];
    }
  ) {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          $or: [
            {
              "user.discordUserId": userId,
            },
            {
              "shareManageOptions.invites": {
                $elemMatch: {
                  discordUserId: userId,
                  status: UserFeedManagerStatus.Accepted,
                },
              },
            },
          ],
        },
      },
      {
        $addFields: {
          ownedByUser: {
            $eq: ["$user.discordUserId", userId],
          },
          computedStatus: {
            $cond: {
              if: {
                $or: [
                  ...feedConnectionTypeKeys.map((key) => {
                    return {
                      $anyElementTrue: {
                        $map: {
                          input: `$connections.${key}`,
                          as: "c",
                          in: {
                            $in: [`$$c.disabledCode`, badConnectionCodes],
                          },
                        },
                      },
                    };
                  }),
                  {
                    $in: ["$disabledCode", badUserFeedCodes],
                  },
                ],
              },
              then: UserFeedComputedStatus.RequiresAttention,
              else: {
                $cond: {
                  if: {
                    $eq: ["$disabledCode", UserFeedDisabledCode.Manual],
                  },
                  then: UserFeedComputedStatus.ManuallyDisabled,
                  else: UserFeedComputedStatus.Ok,
                },
              },
            },
          },
        },
      },
    ];

    const $match: FilterQuery<any> = {};

    if (filters?.ownedByUser) {
      $match.ownedByUser = filters.ownedByUser;
    }

    if (filters?.computedStatuses?.length) {
      $match.computedStatus = {
        $in: filters.computedStatuses,
      };
    }

    if (search) {
      $match.$or = [
        {
          title: new RegExp(_.escapeRegExp(search), "i"),
        },
        {
          url: new RegExp(_.escapeRegExp(search), "i"),
        },
      ];
    }

    if (filters?.disabledCodes) {
      $match.disabledCode = {
        $in: filters.disabledCodes.map((c) => (c === "" ? null : c)),
      };
    }

    if (Object.keys($match).length) {
      pipeline.push({
        $match,
      });
    }

    if (filters?.connectionDisabledCodes) {
      const codesToSearchFor = filters.connectionDisabledCodes.map((c) =>
        c === "" ? null : c
      );

      const toPush: PipelineStage = {
        $match: {
          $or: feedConnectionTypeKeys.map((key) => ({
            [`connections.${key}.disabledCode`]: {
              $in: codesToSearchFor,
            },
          })),
        },
      };

      if (codesToSearchFor.includes(null)) {
        // @ts-ignore
        toPush.$match.$or.push({
          [`connections.0`]: {
            $exists: false,
          },
        });
      }

      pipeline.push(toPush);
    }

    return pipeline;
  }

  async enforceUserFeedLimits(
    supporterLimits: Array<{
      discordUserId: string;
      maxUserFeeds: number;
      refreshRateSeconds: number;
    }>
  ) {
    const supporterDiscordUserIds = supporterLimits.map(
      ({ discordUserId }) => discordUserId
    );
    const defaultMaxUserFeeds = this.supportersService.defaultMaxUserFeeds;

    await this.enforceRefreshRates(supporterLimits);

    // Handle non-supporter feed disabling first
    const usersToDisable = await this.userFeedModel
      .aggregate([
        {
          $match: {
            "user.discordUserId": {
              $nin: supporterDiscordUserIds,
            },
          },
        },
        {
          $group: {
            _id: "$user.discordUserId",
            disabledCount: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$disabledCode",
                      UserFeedDisabledCode.ExceededFeedLimit,
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            enabledCount: {
              $sum: {
                $cond: [
                  {
                    $ne: [
                      "$disabledCode",
                      UserFeedDisabledCode.ExceededFeedLimit,
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        {
          $match: {
            enabledCount: {
              $gt: defaultMaxUserFeeds,
            },
          },
        },
      ])
      .cursor();

    for await (const { _id: discordUserId, enabledCount } of usersToDisable) {
      const docs = await this.userFeedModel
        .find({
          "user.discordUserId": discordUserId,
          disabledCode: {
            $ne: UserFeedDisabledCode.ExceededFeedLimit,
          },
        })
        .sort({
          // Disable the oldest feeds first
          createdAt: 1,
        })
        .limit(enabledCount - defaultMaxUserFeeds)
        .select("_id")
        .lean();

      await this.userFeedModel.updateMany(
        {
          _id: {
            $in: docs.map((doc) => doc._id),
          },
        },
        {
          $set: {
            disabledCode: UserFeedDisabledCode.ExceededFeedLimit,
          },
        }
      );
    }

    // Handle feed enabling now
    const usersToEnable = this.userFeedModel
      .aggregate([
        {
          $match: {
            "user.discordUserId": {
              $nin: supporterDiscordUserIds,
            },
          },
        },
        {
          $group: {
            _id: "$user.discordUserId",
            disabledCount: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$disabledCode",
                      UserFeedDisabledCode.ExceededFeedLimit,
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            enabledCount: {
              $sum: {
                $cond: [
                  {
                    $ne: [
                      "$disabledCode",
                      UserFeedDisabledCode.ExceededFeedLimit,
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        {
          $match: {
            enabledCount: {
              $lt: defaultMaxUserFeeds,
            },
            // We should only be enabling feeds if some of them are disabled because of the feed limit
            disabledCount: {
              $gt: 0,
            },
          },
        },
      ])
      .cursor();

    for await (const { _id: discordUserId, enabledCount } of usersToEnable) {
      const countToEnable = defaultMaxUserFeeds - enabledCount;

      if (countToEnable === 0) {
        return;
      }

      const docs = await this.userFeedModel
        .find({
          "user.discordUserId": discordUserId,
          disabledCode: UserFeedDisabledCode.ExceededFeedLimit,
        })
        .sort({
          // Re-enable the newest feeds first
          createdAt: -1,
        })
        .limit(countToEnable)
        .select("_id")
        .lean();

      await this.userFeedModel.updateMany(
        {
          _id: {
            $in: docs.map((doc) => doc._id),
          },
        },
        {
          $unset: {
            disabledCode: "",
          },
        }
      );
    }

    await this.enforceSupporterLimits(supporterLimits);
  }

  private async enforceSupporterLimits(
    supporterLimits: Array<{ discordUserId: string; maxUserFeeds: number }>
  ) {
    const chunks = chunk(supporterLimits, 5);

    for (let i = 0; i < chunks.length; ++i) {
      const chunk = chunks[i];

      await Promise.all(
        chunk.map(async ({ discordUserId, maxUserFeeds }) => {
          const undisabledFeedCount = await this.userFeedModel.countDocuments({
            "user.discordUserId": discordUserId,
            disabledCode: {
              $ne: UserFeedDisabledCode.ExceededFeedLimit,
            },
          });

          if (undisabledFeedCount === maxUserFeeds) {
            return;
          }

          if (undisabledFeedCount > maxUserFeeds) {
            logger.info(
              `Disabling ${
                undisabledFeedCount - maxUserFeeds
              } feeds for user ${discordUserId} (limit: ${maxUserFeeds})`
            );
            const docs = await this.userFeedModel
              .find({
                "user.discordUserId": discordUserId,
                disabledCode: {
                  $ne: UserFeedDisabledCode.ExceededFeedLimit,
                },
              })
              .sort({
                // Disable the oldest feeds first
                createdAt: 1,
              })
              .limit(undisabledFeedCount - maxUserFeeds)
              .select("_id")
              .lean();

            await this.userFeedModel.updateMany(
              {
                _id: {
                  $in: docs.map((doc) => doc._id),
                },
              },
              {
                $set: {
                  disabledCode: UserFeedDisabledCode.ExceededFeedLimit,
                },
              }
            );

            return;
          }

          const enableCount = maxUserFeeds - undisabledFeedCount;

          // Some feeds should be enabled
          const disabledFeedCount = await this.userFeedModel.countDocuments({
            "user.discordUserId": discordUserId,
            disabledCode: UserFeedDisabledCode.ExceededFeedLimit,
          });

          if (disabledFeedCount > 0) {
            logger.info(
              `Enabling ${enableCount} feeds for user ${discordUserId} (limit: ${maxUserFeeds})`
            );

            const docs = await this.userFeedModel
              .find({
                "user.discordUserId": discordUserId,
                disabledCode: UserFeedDisabledCode.ExceededFeedLimit,
              })
              .sort({
                // Re-enable the newest feeds first
                createdAt: -1,
              })
              .limit(enableCount)
              .select("_id")
              .lean();

            await this.userFeedModel.updateMany(
              {
                _id: {
                  $in: docs.map((doc) => doc._id),
                },
              },
              {
                $unset: {
                  disabledCode: "",
                },
              }
            );

            return;
          }
        })
      );
    }
  }

  private async enforceRefreshRates(
    supporterLimits: Array<{
      discordUserId: string;
      maxUserFeeds: number;
      refreshRateSeconds: number;
    }>
  ) {
    const supporterRefreshRate =
      this.supportersService.defaultSupporterRefreshRateSeconds;

    const supporterDiscordUserIds = supporterLimits
      .filter(
        ({ refreshRateSeconds }) => refreshRateSeconds === supporterRefreshRate
      )
      .map(({ discordUserId }) => discordUserId);

    await this.userFeedModel.updateMany(
      {
        userRefreshRateSeconds: supporterRefreshRate,
        "user.discordUserId": {
          $nin: supporterDiscordUserIds,
        },
      },
      {
        $unset: {
          userRefreshRateSeconds: "",
        },
      }
    );
  }

  private async checkUrlIsValid(url: string) {
    await this.feedFetcherService.fetchFeed(url, {
      fetchOptions: {
        useServiceApi: true,
        useServiceApiCache: false,
      },
    });

    const bannedRecord = await this.feedsService.getBannedFeedDetails(url, "");

    if (bannedRecord) {
      throw new BannedFeedException();
    }
  }
}

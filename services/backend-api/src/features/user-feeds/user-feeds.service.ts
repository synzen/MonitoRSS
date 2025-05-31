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
import { chunk } from "lodash";
import { SupportersService } from "../supporters/supporters.service";
import {
  DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS,
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
import {
  GetArticlesInput,
  GetArticlesResponseRequestStatus,
} from "../../services/feed-handler/types";
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
import { FeedFetcherFetchStatus } from "../../services/feed-fetcher/types";
import { CreateDiscordChannelConnectionOutputDto } from "../feed-connections/dto";
import { convertToNestedDiscordEmbed } from "../../utils/convert-to-nested-discord-embed";
import { CustomPlaceholderStepType } from "../../common/constants/custom-placeholder-step-type.constants";
import {
  FeedFetchTimeoutException,
  FeedParseException,
  FeedRequestException,
  NoFeedOnHtmlPageException,
} from "../../services/feed-fetcher/exceptions";
import { UsersService } from "../users/users.service";
import { FeedRequestLookupDetails } from "../../common/types/feed-request-lookup-details.type";
import getFeedRequestLookupDetails from "../../utils/get-feed-request-lookup-details";
import { ConfigService } from "@nestjs/config";
import { User, UserModel } from "../users/entities/user.entity";
import { randomUUID } from "crypto";
import {
  CopyUserFeedSettingsInputDto,
  UserFeedCopyableSetting,
} from "./dto/copy-user-feed-settings-input.dto";
import { generateUserFeedOwnershipFilters } from "./utils/get-user-feed-ownership-filters.utils";
import { generateUserFeedSearchFilters } from "./utils/get-user-feed-search-filters.utils";
import { UserFeedTargetFeedSelectionType } from "./constants/target-feed-selection-type.type";

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
    @InjectModel(User.name) private readonly userModel: UserModel,
    @InjectModel(UserFeed.name) private readonly userFeedModel: UserFeedModel,
    @InjectModel(Feed.name) private readonly feedModel: FeedModel,
    @InjectModel(UserFeedLimitOverride.name)
    private readonly limitOverrideModel: UserFeedLimitOverrideModel,
    @InjectModel(LegacyFeedConversionJob.name)
    private readonly legacyFeedConversionJobModel: LegacyFeedConversionJobModel,
    private readonly configService: ConfigService,
    private readonly feedsService: FeedsService,
    private readonly feedFetcherService: FeedFetcherService,
    private readonly supportersService: SupportersService,
    private readonly feedHandlerService: FeedHandlerService,
    private readonly feedFetcherApiService: FeedFetcherApiService,
    private readonly amqpConnection: AmqpConnection,
    private readonly feedConnectionsDiscordChannelsService: FeedConnectionsDiscordChannelsService,
    private readonly usersService: UsersService
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
        inputUrl: feed.inputUrl,
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

  async deduplicateFeedUrls(discordUserId: string, urls: string[]) {
    const found = await this.userFeedModel
      .find(
        {
          url: {
            $in: urls,
          },
          "user.discordUserId": discordUserId,
        },
        {
          url: 1,
        }
      )
      .lean();

    const foundUrls = new Set(found.map((f) => f.url));

    return urls.filter((u) => !foundUrls.has(u));
  }

  async validateFeedUrl(
    { discordUserId }: { discordUserId: string },
    { url }: { url: string }
  ) {
    const [, user] = await Promise.all([
      this.supportersService.getBenefitsOfDiscordUser(discordUserId),
      this.usersService.getOrCreateUserByDiscordId(discordUserId),
    ]);

    const tempLookupDetails = getFeedRequestLookupDetails({
      decryptionKey: this.configService.get("BACKEND_API_ENCRYPTION_KEY_HEX"),
      feed: {
        url,
        feedRequestLookupKey: randomUUID(),
      },
      user,
    });

    const { finalUrl, feedTitle } = await this.checkUrlIsValid(
      url,
      tempLookupDetails
    );

    if (finalUrl !== url) {
      return {
        resolvedToUrl: finalUrl,
      };
    }

    return { resolvedToUrl: null, feedTitle };
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
      title?: string;
      url: string;
    }
  ) {
    const [{ maxUserFeeds, maxDailyArticles, refreshRateSeconds }, user] =
      await Promise.all([
        this.supportersService.getBenefitsOfDiscordUser(discordUserId),
        this.usersService.getOrCreateUserByDiscordId(discordUserId),
      ]);

    const userId = user._id;

    const feedCount = await this.calculateCurrentFeedCountOfDiscordUser(
      discordUserId
    );

    if (feedCount >= maxUserFeeds) {
      throw new FeedLimitReachedException("Max feeds reached");
    }

    const tempLookupDetails = getFeedRequestLookupDetails({
      decryptionKey: this.configService.get("BACKEND_API_ENCRYPTION_KEY_HEX"),
      feed: {
        url,
        feedRequestLookupKey: randomUUID(),
      },
      user,
    });

    const { finalUrl, enableDateChecks, feedTitle } =
      await this.checkUrlIsValid(url, tempLookupDetails);

    const created = await this.userFeedModel.create({
      title: title || feedTitle || "Untitled Feed",
      url: finalUrl,
      inputUrl: url,
      user: {
        id: userId,
        discordUserId,
      },
      refreshRateSeconds,
      maxDailyArticles,
      feedRequestLookupKey: tempLookupDetails?.key,
      dateCheckOptions: enableDateChecks
        ? {
            oldArticleDateDiffMsThreshold: 1000 * 60 * 60 * 24, // 1 day
          }
        : undefined,
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

    const user = await this.usersService.getOrCreateUserByDiscordId(
      found.user.discordUserId
    );

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

    let inputUrl = found.inputUrl;
    let finalUrl = found.url;

    if (data?.url && data.url !== found.url) {
      finalUrl = (
        await this.checkUrlIsValid(
          data.url,
          getFeedRequestLookupDetails({
            feed: found,
            user,
            decryptionKey: this.configService.get(
              "BACKEND_API_ENCRYPTION_KEY_HEX"
            ),
          })
        )
      ).finalUrl;
      inputUrl = data.url;
    }

    await this.userFeedModel.create({
      ...found,
      _id: newFeedId,
      title: data?.title || found.title,
      url: finalUrl,
      inputUrl,
      connections: {},
      feedRequestLookupKey: undefined,
      createdAt: new Date(),
    });

    await this.usersService.syncLookupKeys({ feedIds: [newFeedId] });

    for (const c of found.connections.discordChannels) {
      await this.feedConnectionsDiscordChannelsService.cloneConnection(
        c,
        {
          name: c.name,
          targetFeedIds: [newFeedId.toHexString()],
        },
        userAccessToken,
        found.user.discordUserId
      );
    }

    return {
      id: newFeedId.toHexString(),
    };
  }

  async copySettings({
    sourceFeed,
    dto: {
      targetFeedIds: inputTargetFeedIds,
      settings: settingsToCopy,
      targetFeedSearch,
      targetFeedSelectionType,
    },
    discordUserId,
  }: {
    sourceFeed: UserFeed;
    dto: CopyUserFeedSettingsInputDto;
    discordUserId: string;
  }) {
    // this.userFeedModel.updateMany({})
    const setQuery: UpdateQuery<UserFeedDocument>["$set"] = {};

    if (settingsToCopy.includes(UserFeedCopyableSetting.PassingComparisons)) {
      setQuery.passingComparisons = sourceFeed.passingComparisons;
    }

    if (settingsToCopy.includes(UserFeedCopyableSetting.BlockingComparisons)) {
      setQuery.blockingComparisons = sourceFeed.blockingComparisons;
    }

    if (settingsToCopy.includes(UserFeedCopyableSetting.ExternalProperties)) {
      setQuery.externalProperties = sourceFeed.externalProperties?.map((p) => ({
        ...p,
        id: new Types.ObjectId().toHexString(),
      }));
    }

    if (settingsToCopy.includes(UserFeedCopyableSetting.DateChecks)) {
      setQuery.dateCheckOptions = sourceFeed.dateCheckOptions;
    }

    if (
      settingsToCopy.includes(UserFeedCopyableSetting.DatePlaceholderSettings)
    ) {
      setQuery.formatOptions = {
        ...sourceFeed.formatOptions,
        dateFormat: sourceFeed.formatOptions?.dateFormat,
        dateTimezone: sourceFeed.formatOptions?.dateTimezone,
        dateLocale: sourceFeed.formatOptions?.dateLocale,
      };
    }

    if (settingsToCopy.includes(UserFeedCopyableSetting.RefreshRate)) {
      setQuery.userRefreshRateSeconds = sourceFeed.userRefreshRateSeconds;
    }

    const selectionTypeSelectedFilters = {
      _id: {
        $in: inputTargetFeedIds?.map((id) => new Types.ObjectId(id)),
      },
      ...generateUserFeedOwnershipFilters(discordUserId),
    };
    const selectionTypeAllFilters = {
      _id: {
        $ne: sourceFeed._id,
      },
      $and: [
        {
          ...(targetFeedSearch
            ? generateUserFeedSearchFilters(targetFeedSearch)
            : {}),
        },
        {
          ...generateUserFeedOwnershipFilters(discordUserId),
        },
      ],
    };
    const useFilters =
      targetFeedSelectionType === UserFeedTargetFeedSelectionType.All
        ? selectionTypeAllFilters
        : selectionTypeSelectedFilters;

    if (settingsToCopy.includes(UserFeedCopyableSetting.Connections)) {
      const feedsWithApplicationWebhooks = await this.userFeedModel
        .find({
          ...useFilters,
          "connections.discordChannels.details.webhook.isApplicationOwned":
            true,
        })
        .select("connections")
        .lean();

      await Promise.all(
        feedsWithApplicationWebhooks.map(async (f) => {
          await Promise.all(
            f.connections.discordChannels.map(async (c) => {
              if (c.details.webhook?.isApplicationOwned === true) {
                await this.feedConnectionsDiscordChannelsService.deleteConnection(
                  f._id.toHexString(),
                  c.id.toHexString()
                );
              }
            })
          );
        })
      );

      setQuery.connections = {
        discordChannels: sourceFeed.connections.discordChannels.map((c) => ({
          ...c,
          id: new Types.ObjectId().toHexString(),
        })),
      };
    }

    await this.userFeedModel.updateMany(useFilters, {
      $set: setQuery,
    });
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

      this.amqpConnection.publish("", MessageBrokerQueue.FeedDeleted, {
        data: { feed: { id: thisId } },
      });
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
        $and: [
          {
            _id: {
              $in: feedIds.map((id) => new Types.ObjectId(id)),
            },
          },
          {
            $or: [
              {
                disabledCode: {
                  $exists: false,
                },
              },
              {
                disabledCode: {
                  $in: DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS,
                },
              },
            ],
          },
        ],
      })
      .select("_id user")
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

    const discordUserIds = found.map((doc) => doc.user.discordUserId);

    try {
      await Promise.all(
        discordUserIds.map((id) => this.enforceUserFeedLimit(id))
      );
    } catch (err) {
      logger.error(
        `Failed to enforce user feed limit after bulk disabling feeds`,
        {
          stack: (err as Error).stack,
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
      .select("_id user")
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

    const discordUserIds = found.map((doc) => doc.user.discordUserId);

    try {
      await Promise.all(
        discordUserIds.map((id) => this.enforceUserFeedLimit(id))
      );
    } catch (err) {
      logger.error(
        `Failed to enforce user feed limit after bulk disabling feeds`,
        {
          stack: (err as Error).stack,
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
      inputUrl?: string;
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
          inputUrl: 1,
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
    feed,
    url,
    query,
  }: {
    feed: UserFeed;
    url: string;
    query: Record<string, string>;
  }) {
    const lookupDetails = getFeedRequestLookupDetails({
      feed,
      user: await this.usersService.getOrCreateUserByDiscordId(
        feed.user.discordUserId
      ),
      decryptionKey: this.configService.get("BACKEND_API_ENCRYPTION_KEY_HEX"),
    });

    return this.feedFetcherApiService.getRequests({
      query,
      url: lookupDetails?.url || url,
      requestLookupKey: lookupDetails?.key,
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

  async updateFeedById(
    { id, disabledCode }: { id: string; disabledCode?: UserFeedDisabledCode },
    updates: UpdateFeedInput
  ) {
    let userBenefits: Awaited<
      ReturnType<typeof this.supportersService.getBenefitsOfDiscordUser>
    > | null = null;

    const feed = await this.userFeedModel
      .findById(new Types.ObjectId(id))
      .lean();

    if (!feed) {
      throw new Error(`Feed ${id} not found while updating feed`);
    }

    const user = await this.usersService.getOrCreateUserByDiscordId(
      feed.user.discordUserId
    );

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
      const { finalUrl } = await this.checkUrlIsValid(
        updates.url,
        getFeedRequestLookupDetails({
          feed,
          user,
          decryptionKey: this.configService.get(
            "BACKEND_API_ENCRYPTION_KEY_HEX"
          ),
        })
      );
      useUpdateObject.$set!.url = finalUrl;
      useUpdateObject.$set!.inputUrl = updates.url;
    }

    if (updates.disabledCode !== undefined) {
      if (!userBenefits) {
        userBenefits = await this.supportersService.getBenefitsOfDiscordUser(
          user.discordUserId
        );
      }

      if (
        updates.disabledCode === null &&
        disabledCode &&
        DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS.includes(disabledCode)
      ) {
        const currentFeedCount = await this.userFeedModel.countDocuments({
          "user.discordUserId": user.discordUserId,
          disabledCode: {
            $nin: DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS,
          },
        });

        if (userBenefits.maxUserFeeds <= currentFeedCount) {
          throw new FeedLimitReachedException(
            `Cannot enable feed ${id} because user ${user.discordUserId} has reached the feed limit`
          );
        }
      }

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
      if (!userBenefits) {
        userBenefits = await this.supportersService.getBenefitsOfDiscordUser(
          user.discordUserId
        );
      }

      const { refreshRateSeconds: fastestPossibleRate } = userBenefits;

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
          `Refresh rate ${updates.userRefreshRateSeconds} is not allowed for user ${user.discordUserId}`
        );
      } else {
        useUpdateObject.$set!.userRefreshRateSeconds =
          updates.userRefreshRateSeconds;
      }
    }

    const u = await this.userFeedModel
      .findByIdAndUpdate(id, useUpdateObject, {
        new: true,
      })
      .lean();

    if (updates.url) {
      // All stored articles of the old feed are now irrelevant
      this.amqpConnection.publish("", MessageBrokerQueue.FeedDeleted, {
        data: { feed: { id } },
      });
    }

    if (
      u &&
      (updates.disabledCode === null ||
        (updates.disabledCode &&
          DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS.includes(
            updates.disabledCode
          )))
    ) {
      await this.enforceUserFeedLimit(u.user.discordUserId);
    }

    return u;
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

    this.amqpConnection.publish("", MessageBrokerQueue.FeedDeleted, {
      data: { feed: { id } },
    });

    return found;
  }

  async retryFailedFeed(feedId: string) {
    await this.usersService.syncLookupKeys({
      feedIds: [new Types.ObjectId(feedId)],
    });
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

    const user = await this.usersService.getOrCreateUserByDiscordId(
      feed.user.discordUserId
    );

    const lookupDetails = getFeedRequestLookupDetails({
      feed,
      user,
      decryptionKey: this.configService.get("BACKEND_API_ENCRYPTION_KEY_HEX"),
    });

    await this.feedFetcherService.fetchFeed(
      lookupDetails?.url || feed.url,
      lookupDetails,
      {
        fetchOptions: {
          useServiceApi: true,
          useServiceApiCache: false,
          debug: feed.debug,
        },
      }
    );

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
    const user = await this.usersService.getOrCreateUserByDiscordId(
      feed.user.discordUserId
    );

    await this.usersService.syncLookupKeys({
      feedIds: [feed._id],
    });
    const lookupDetails = getFeedRequestLookupDetails({
      feed,
      user,
      decryptionKey: this.configService.get("BACKEND_API_ENCRYPTION_KEY_HEX"),
    });

    const res = await this.feedFetcherApiService.fetchAndSave(
      lookupDetails?.url || feed.url,
      lookupDetails,
      {
        getCachedResponse: false,
      }
    );

    const isRequestSuccessful =
      res.requestStatus === FeedFetcherFetchStatus.Success;
    let canBeEnabled = isRequestSuccessful;

    if (
      isRequestSuccessful &&
      feed.disabledCode === UserFeedDisabledCode.InvalidFeed
    ) {
      const res2 = await this.getFeedArticleProperties({
        feed,
        url: feed.url,
      });

      canBeEnabled =
        isRequestSuccessful &&
        res2.requestStatus === GetArticlesResponseRequestStatus.Success;
    }

    await this.userFeedModel
      .findByIdAndUpdate(feed._id, {
        $set: {
          lastManualRequestAt: requestDate,
          healthStatus: isRequestSuccessful
            ? UserFeedHealthStatus.Ok
            : feed.healthStatus,
        },
        ...(canBeEnabled && {
          $unset: {
            disabledCode: "",
          },
        }),
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
    feed,
  }: GetFeedArticlesInput): Promise<GetFeedArticlesOutput> {
    const user = await this.usersService.getOrCreateUserByDiscordId(
      discordUserId
    );

    return this.feedHandlerService.getArticles(
      {
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
      },
      getFeedRequestLookupDetails({
        feed,
        user,
        decryptionKey: this.configService.get("BACKEND_API_ENCRYPTION_KEY_HEX"),
      })
    );
  }

  async getFeedArticleProperties({
    url,
    customPlaceholders,
    feed,
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

    const user = await this.usersService.getOrCreateUserByDiscordId(
      feed.user.discordUserId
    );

    const { articles, requestStatus } =
      await this.feedHandlerService.getArticles(
        input,
        getFeedRequestLookupDetails({
          feed,
          user,
          decryptionKey: this.configService.get(
            "BACKEND_API_ENCRYPTION_KEY_HEX"
          ),
        })
      );

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
        $match: generateUserFeedOwnershipFilters(userId),
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
                  else: {
                    $cond: {
                      if: {
                        $eq: ["$healthStatus", UserFeedHealthStatus.Failing],
                      },
                      then: UserFeedComputedStatus.Retrying,
                      else: UserFeedComputedStatus.Ok,
                    },
                  },
                },
              },
            },
          },
        },
      },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      $match.$or = generateUserFeedSearchFilters(search).$or;
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

  async enforceWebhookBenefits(
    opts:
      | {
          enforcementType: "all-users";
          supporterDiscordUserIds: string[];
        }
      | {
          enforcementType: "single-user";
          allowWebhooks: boolean;
          discordUserId: string;
        }
  ) {
    // Find all the user feeds that are not owned by a supporter with active webhooks
    const feedsWithConnectionsToDisable =
      opts.enforcementType === "all-users" || !opts.allowWebhooks
        ? await this.userFeedModel
            .find({
              "user.discordUserId":
                opts.enforcementType === "all-users"
                  ? {
                      $nin: opts.supporterDiscordUserIds,
                    }
                  : opts.discordUserId,
              "connections.discordChannels": {
                $elemMatch: {
                  "details.webhook.id": {
                    $exists: true,
                  },
                  disabledCode: {
                    $nin: [
                      FeedConnectionDisabledCode.NotPaidSubscriber,
                      FeedConnectionDisabledCode.Manual,
                    ],
                  },
                },
              },
            })
            .select("_id")
            .lean()
        : [];

    // Disable the connections for those feeds
    const feedIds = feedsWithConnectionsToDisable.map((feed) => feed._id);

    for (const feedId of feedIds) {
      const feed = await this.userFeedModel.findById(feedId);

      if (!feed) {
        continue;
      }

      feed.connections.discordChannels
        .filter(
          (c) =>
            !!c.details.webhook?.id &&
            c.disabledCode !== FeedConnectionDisabledCode.Manual &&
            c.disabledCode !== FeedConnectionDisabledCode.NotPaidSubscriber
        )
        .forEach((c) => {
          c.disabledCode = FeedConnectionDisabledCode.NotPaidSubscriber;
        });

      await feed.save();
    }

    const feedsWithConnectionsToEnable =
      opts.enforcementType === "all-users" || opts.allowWebhooks
        ? await this.userFeedModel
            .find({
              "user.discordUserId":
                opts.enforcementType === "all-users"
                  ? {
                      $in: opts.supporterDiscordUserIds,
                    }
                  : opts.discordUserId,
              "connections.discordChannels": {
                $elemMatch: {
                  "details.webhook.id": {
                    $exists: true,
                  },
                  disabledCode: {
                    $eq: FeedConnectionDisabledCode.NotPaidSubscriber,
                  },
                },
              },
            })
            .select("_id")
            .lean()
        : [];

    // Enable the connections for those feeds
    const feedIds2 = feedsWithConnectionsToEnable.map((feed) => feed._id);

    for (const feedId of feedIds2) {
      const feed = await this.userFeedModel.findById(feedId);

      if (!feed) {
        continue;
      }

      feed.connections.discordChannels
        .filter(
          (c) =>
            !!c.details.webhook?.id &&
            c.disabledCode === FeedConnectionDisabledCode.NotPaidSubscriber
        )
        .forEach((c) => {
          c.disabledCode = undefined;
        });

      await feed.save();
    }

    return {
      disabledCount: feedsWithConnectionsToDisable.length,
      enabledCount: feedsWithConnectionsToEnable.length,
    };
  }

  async enforceUserFeedLimit(discordUserId: string) {
    const { isSupporter, refreshRateSeconds, maxUserFeeds } =
      await this.supportersService.getBenefitsOfDiscordUser(discordUserId);

    await this.enforceWebhookBenefits({
      enforcementType: "single-user",
      allowWebhooks: isSupporter,
      discordUserId,
    });

    await this.enforceRefreshRates({
      enforcementType: "single-user",
      discordUserId,
      refreshRateSeconds,
    });

    if (isSupporter) {
      await this.enforceSupporterLimits({
        enforcementType: "single-user",
        discordUserId,
        maxUserFeeds,
      });
    } else {
      await this.enforceNonSupporterLimits({
        enforcementType: "single-user",
        discordUserId,
      });
    }
  }

  async enforceAllUserFeedLimits(
    supporterLimits: Array<{
      discordUserId: string;
      maxUserFeeds: number;
      refreshRateSeconds: number;
    }>
  ) {
    const supporterDiscordUserIds = supporterLimits.map(
      ({ discordUserId }) => discordUserId
    );
    await this.enforceWebhookBenefits({
      enforcementType: "all-users",
      supporterDiscordUserIds,
    });

    await this.enforceRefreshRates({
      enforcementType: "all-users",
      supporterLimits,
    });

    await this.enforceNonSupporterLimits({
      enforcementType: "all-users",
      supporterDiscordUserIds,
    });
    await this.enforceSupporterLimits({
      enforcementType: "all-users",
      supporterLimits,
    });
  }

  private async enforceNonSupporterLimits(
    opts:
      | {
          enforcementType: "all-users";
          supporterDiscordUserIds: Array<string>;
        }
      | {
          enforcementType: "single-user";
          discordUserId: string;
        }
  ) {
    const defaultMaxUserFeeds = this.supportersService.defaultMaxUserFeeds;

    // Handle non-supporter feed disabling first
    const usersWithPotentialFeedsToDisable = await this.userFeedModel
      .aggregate([
        {
          $match: {
            "user.discordUserId":
              opts.enforcementType === "all-users"
                ? {
                    $nin: opts.supporterDiscordUserIds,
                  }
                : opts.discordUserId,
          },
        },
        {
          $group: {
            _id: "$user.discordUserId",
            enabledCount: {
              $sum: {
                $cond: [
                  {
                    $not: [
                      {
                        $in: [
                          "$disabledCode",
                          DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS,
                        ],
                      },
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

    for await (const {
      _id: discordUserId,
      enabledCount,
    } of usersWithPotentialFeedsToDisable) {
      const docs = await this.userFeedModel
        .find({
          "user.discordUserId": discordUserId,
          disabledCode: {
            $nin: DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS,
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
            "user.discordUserId":
              opts.enforcementType === "all-users"
                ? {
                    $nin: opts.supporterDiscordUserIds,
                  }
                : opts.discordUserId,
          },
        },
        {
          $group: {
            _id: "$user.discordUserId",
            disabledCount: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      "$disabledCode",
                      [UserFeedDisabledCode.ExceededFeedLimit],
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
                    $not: [
                      {
                        $in: [
                          "$disabledCode",
                          DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS,
                        ],
                      },
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
          disabledCode: {
            $in: UserFeedDisabledCode.ExceededFeedLimit,
          },
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
  }

  private async enforceSupporterLimits(
    opts:
      | {
          enforcementType: "all-users";
          supporterLimits: Array<{
            discordUserId: string;
            maxUserFeeds: number;
          }>;
        }
      | {
          enforcementType: "single-user";
          discordUserId: string;
          maxUserFeeds: number;
        }
  ) {
    const chunks =
      opts.enforcementType === "all-users"
        ? chunk(opts.supporterLimits, 5)
        : [
            [
              {
                discordUserId: opts.discordUserId,
                maxUserFeeds: opts.maxUserFeeds,
              },
            ],
          ];

    for (let i = 0; i < chunks.length; ++i) {
      const chunk = chunks[i];

      await Promise.all(
        chunk.map(async ({ discordUserId, maxUserFeeds }) => {
          const countOfFeedsForLimit = await this.userFeedModel.countDocuments({
            "user.discordUserId": discordUserId,
            disabledCode: {
              $nin: DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS,
            },
          });

          if (countOfFeedsForLimit === maxUserFeeds) {
            return;
          }

          if (countOfFeedsForLimit > maxUserFeeds) {
            logger.info(
              `Disabling ${
                countOfFeedsForLimit - maxUserFeeds
              } feeds for user ${discordUserId} (limit: ${maxUserFeeds})`
            );
            const allowableFeedsUnderLimit = await this.userFeedModel
              .find({
                "user.discordUserId": discordUserId,
                disabledCode: {
                  $nin: DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS,
                },
              })
              .sort({
                // Disable the oldest feeds first
                createdAt: 1,
              })
              .limit(countOfFeedsForLimit - maxUserFeeds)
              .select("_id")
              .lean();

            await this.userFeedModel.updateMany(
              {
                _id: {
                  $in: allowableFeedsUnderLimit.map((doc) => doc._id),
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

          const enableCount = maxUserFeeds - countOfFeedsForLimit;

          // Some feeds should be enabled
          const disabledFeedCount = await this.userFeedModel.countDocuments({
            "user.discordUserId": discordUserId,
            disabledCode: {
              $in: DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS,
            },
          });

          if (disabledFeedCount > 0) {
            logger.info(
              `Enabling ${enableCount} feeds for user ${discordUserId} (limit: ${maxUserFeeds})`
            );

            const docs = await this.userFeedModel
              .find({
                "user.discordUserId": discordUserId,
                disabledCode: {
                  $in: UserFeedDisabledCode.ExceededFeedLimit,
                },
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
    opts:
      | {
          enforcementType: "all-users";
          supporterLimits: Array<{
            discordUserId: string;
            maxUserFeeds: number;
            refreshRateSeconds: number;
          }>;
        }
      | {
          enforcementType: "single-user";
          discordUserId: string;
          refreshRateSeconds: number;
        }
  ) {
    // Unset the lower user refresh rate seconds for users who are not supporters
    const supporterRefreshRate =
      this.supportersService.defaultSupporterRefreshRateSeconds;

    if (opts.enforcementType === "all-users") {
      const supporterDiscordUserIds = opts.supporterLimits
        .filter(
          ({ refreshRateSeconds }) =>
            refreshRateSeconds === supporterRefreshRate
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
    } else {
      const { discordUserId, refreshRateSeconds } = opts;

      if (refreshRateSeconds === supporterRefreshRate) {
        // If the user is a supporter, we don't need to do anything
        return;
      }

      await this.userFeedModel.updateMany(
        {
          userRefreshRateSeconds: refreshRateSeconds,
          "user.discordUserId": discordUserId,
        },
        {
          $unset: {
            userRefreshRateSeconds: "",
          },
        }
      );
    }
  }

  private async checkUrlIsValid(
    url: string,
    lookupDetails: FeedRequestLookupDetails | null
  ): Promise<{
    finalUrl: string;
    enableDateChecks: boolean;
    feedTitle: string | null;
  }> {
    const getArticlesResponse = await this.feedHandlerService.getArticles(
      {
        url,
        formatter: {
          options: {
            dateFormat: undefined,
            dateLocale: undefined,
            dateTimezone: undefined,
            disableImageLinkPreviews: false,
            formatTables: false,
            stripImages: false,
          },
        },
        selectProperties: ["date"],
        limit: 1,
        skip: 0,
        findRssFromHtml: true,
        executeFetchIfStale: true,
      },
      lookupDetails
    );

    const {
      requestStatus,
      url: finalUrl,
      attemptedToResolveFromHtml,
      articles,
      feedTitle,
    } = getArticlesResponse;

    if (requestStatus === GetArticlesResponseRequestStatus.Success) {
      const bannedRecord = await this.feedsService.getBannedFeedDetails(
        finalUrl || url,
        ""
      );

      if (bannedRecord) {
        throw new BannedFeedException();
      }

      return {
        finalUrl: finalUrl || url,
        enableDateChecks: !!articles[0]?.date,
        feedTitle: feedTitle || null,
      };
    } else if (requestStatus === GetArticlesResponseRequestStatus.TimedOut) {
      throw new FeedFetchTimeoutException(`Feed fetch timed out`);
    } else if (requestStatus === GetArticlesResponseRequestStatus.ParseError) {
      if (attemptedToResolveFromHtml) {
        throw new NoFeedOnHtmlPageException(`No feed found on HTML page`);
      }

      throw new FeedParseException(
        `Feed host failed to return a valid, parseable feed`
      );
    } else if (
      requestStatus === GetArticlesResponseRequestStatus.BadStatusCode
    ) {
      const statusCode = getArticlesResponse.response?.statusCode;

      if (!statusCode) {
        throw new FeedRequestException(`Non-200 status code returned`);
      }

      this.feedFetcherService.handleStatusCode(statusCode);
    } else if (requestStatus === GetArticlesResponseRequestStatus.FetchError) {
      throw new FeedRequestException(`Feed fetch failed`);
    }

    throw new Error(`Unhandled request status ${requestStatus}`);
  }
}

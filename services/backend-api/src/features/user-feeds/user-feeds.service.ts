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
import {
  UserFeed,
  UserFeedDocument,
  UserFeedModel,
  UserFeedWithTags,
} from "./entities";
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
import {
  CreateUserFeedInputDto,
  GetUserFeedsInputDto,
  GetUserFeedsInputSortKey,
} from "./dto";
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
import { SourceFeedNotFoundException } from "./exceptions/source-feed-not-found.exception";
import { getUserFeedTagLookupAggregateStage } from "./constants/user-feed-tag-lookup-aggregate-stage.constants";

const badConnectionCodes = Object.values(FeedConnectionDisabledCode).filter(
  (c) => c !== FeedConnectionDisabledCode.Manual
);
const badUserFeedCodes = Object.values(UserFeedDisabledCode).filter(
  (c) => c !== UserFeedDisabledCode.Manual
);
const feedConnectionTypeKeys = Object.values(FeedConnectionTypeEntityKey);

export type UserFeedBulkWriteDocument = Parameters<
  UserFeedModel["bulkWrite"]
>[0][number];

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

  async formatForHttpResponse(feed: UserFeedWithTags, discordUserId: string) {
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
        userTags: feed.userTags,
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
      userAccessToken,
    }: {
      discordUserId: string;
      userAccessToken: string;
    },
    { title, url, sourceFeedId }: CreateUserFeedInputDto
  ) {
    const [
      { maxUserFeeds, maxDailyArticles, refreshRateSeconds },
      user,
      sourceFeedToCopyFrom,
    ] = await Promise.all([
      this.supportersService.getBenefitsOfDiscordUser(discordUserId),
      this.usersService.getOrCreateUserByDiscordId(discordUserId),
      sourceFeedId
        ? this.userFeedModel
            .findOne({
              _id: new Types.ObjectId(sourceFeedId),
              ...generateUserFeedOwnershipFilters(discordUserId),
            })
            .lean()
        : null,
    ]);

    if (sourceFeedId && !sourceFeedToCopyFrom) {
      throw new SourceFeedNotFoundException(
        `Feed with ID ${sourceFeedId} not found for user ${discordUserId}`
      );
    }

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

    const { connections, ...propertiesToCopy } = sourceFeedToCopyFrom || {};

    const created = await this.userFeedModel.create({
      ...propertiesToCopy,
      _id: new Types.ObjectId(),
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

    if (connections) {
      for (const c of connections.discordChannels) {
        await this.feedConnectionsDiscordChannelsService.cloneConnection(
          c,
          {
            targetFeedSelectionType: UserFeedTargetFeedSelectionType.Selected,
            name: c.name,
            targetFeedIds: [created._id.toHexString()],
          },
          userAccessToken,
          discordUserId
        );
      }
    }

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
    const foundResult = await this.userFeedModel.findById(feedId).lean();

    if (!foundResult) {
      throw new Error(`Feed ${feedId} not found while cloning`);
    }

    const { connections, ...sourceFeed } = foundResult;

    const user = await this.usersService.getOrCreateUserByDiscordId(
      sourceFeed.user.discordUserId
    );

    const { maxUserFeeds } =
      await this.supportersService.getBenefitsOfDiscordUser(
        sourceFeed.user.discordUserId
      );

    const feedCount = await this.calculateCurrentFeedCountOfDiscordUser(
      sourceFeed.user.discordUserId
    );

    if (feedCount >= maxUserFeeds) {
      throw new FeedLimitReachedException("Max feeds reached");
    }

    const newFeedId = new Types.ObjectId();

    let inputUrl = sourceFeed.inputUrl;
    let finalUrl = sourceFeed.url;

    if (data?.url && data.url !== sourceFeed.url) {
      finalUrl = (
        await this.checkUrlIsValid(
          data.url,
          getFeedRequestLookupDetails({
            feed: sourceFeed,
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
      ...sourceFeed,
      _id: newFeedId,
      title: data?.title || sourceFeed.title,
      url: finalUrl,
      inputUrl,
      connections: {},
      feedRequestLookupKey: undefined,
      createdAt: new Date(),
    });

    await this.usersService.syncLookupKeys({ feedIds: [newFeedId] });

    for (const c of connections.discordChannels) {
      await this.feedConnectionsDiscordChannelsService.cloneConnection(
        c,
        {
          targetFeedSelectionType: UserFeedTargetFeedSelectionType.Selected,
          name: c.name,
          targetFeedIds: [newFeedId.toHexString()],
        },
        userAccessToken,
        sourceFeed.user.discordUserId
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
    const unsetQuery: UpdateQuery<UserFeedDocument>["$unset"] = {};

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
      if (sourceFeed.userRefreshRateSeconds) {
        setQuery.userRefreshRateSeconds = sourceFeed.userRefreshRateSeconds;
      } else {
        unsetQuery.userRefreshRateSeconds = "";
      }
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
      $unset: unsetQuery,
    });
  }

  async bulkDelete(feedIds: string[]) {
    const found = await this.userFeedModel
      .find({
        _id: {
          $in: feedIds.map((id) => new Types.ObjectId(id)),
        },
      })
      .select("_id legacyFeedId connections user")
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

      const allUserIds = Array.from(
        new Set(found.map((doc) => doc.user.discordUserId))
      );

      try {
        await Promise.all(
          allUserIds.map((discordUserId) =>
            this.enforceUserFeedLimit(discordUserId)
          )
        );
      } catch (err) {
        logger.error(
          `Failed to enforce user feed limit after bulk deleting feeds`,
          {
            stack: (err as Error).stack,
          }
        );
      }
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
    userId: Types.ObjectId,
    discordUserId: string,
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
      ...this.generateGetFeedsAggregatePipeline(discordUserId, userId, {
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
          userTags: 1,
        },
      },
    ]);

    return aggregateResults;
  }

  async getFeedCountByUser(
    userId: Types.ObjectId,
    discordUserId: string,
    { search, filters }: Omit<GetUserFeedsInputDto, "offset" | "limit" | "sort">
  ) {
    const aggregateResults = await this.userFeedModel.aggregate([
      ...this.generateGetFeedsAggregatePipeline(discordUserId, userId, {
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
      $unset: {},
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

      if (updates.disabledCode !== null) {
        useUpdateObject.$set!.disabledCode = updates.disabledCode;
      } else {
        useUpdateObject.$unset!.disabledCode = "";
      }
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

    try {
      await this.enforceUserFeedLimit(found.user.discordUserId);
    } catch (err) {
      logger.error(
        `Failed to enforce user feed limit after deleting feed ${id}`,
        {
          stack: (err as Error).stack,
        }
      );
    }

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

    let getArticlesRequestStatus: GetArticlesResponseRequestStatus | null =
      null;

    if (
      isRequestSuccessful &&
      feed.disabledCode === UserFeedDisabledCode.InvalidFeed
    ) {
      const res2 = await this.getFeedArticleProperties({
        feed,
        url: feed.url,
      });

      getArticlesRequestStatus = res2.requestStatus;

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
      getArticlesRequestStatus,
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
    discordUserId: string,
    userId: Types.ObjectId,
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
        $match: generateUserFeedOwnershipFilters(discordUserId),
      },
      {
        $addFields: {
          ownedByUser: {
            $eq: ["$user.discordUserId", discordUserId],
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

    pipeline.push(getUserFeedTagLookupAggregateStage(userId));

    if (filters?.userTagIds?.length) {
      pipeline.push({
        $match: {
          userTags: {
            $elemMatch: {
              _id: {
                $in: filters.userTagIds.map((id) => new Types.ObjectId(id)),
              },
            },
          },
        },
      });
    }

    return pipeline;
  }

  getEnforceWebhookWrites(
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
  ): UserFeedBulkWriteDocument[] {
    const bulkWriteOps: UserFeedBulkWriteDocument[] = [];

    // Find all the user feeds that are not owned by a supporter with active webhooks
    if (opts.enforcementType === "all-users" || !opts.allowWebhooks) {
      bulkWriteOps.push({
        updateMany: {
          filter: {
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
          },
          update: {
            $set: {
              "connections.discordChannels.$[].disabledCode":
                FeedConnectionDisabledCode.NotPaidSubscriber,
            },
          },
        },
      });
    }

    if (opts.enforcementType === "all-users" || opts.allowWebhooks) {
      bulkWriteOps.push({
        updateMany: {
          filter: {
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
          },
          update: {
            // unset the disabledCode for those connections
            $unset: {
              "connections.discordChannels.$[].disabledCode": "",
            },
          },
        },
      });
    }

    return bulkWriteOps;
  }

  async enforceUserFeedLimit(discordUserId: string) {
    const { isSupporter, refreshRateSeconds, maxUserFeeds } =
      await this.supportersService.getBenefitsOfDiscordUser(discordUserId);

    const enforceWebhookDocs = this.getEnforceWebhookWrites({
      enforcementType: "single-user",
      allowWebhooks: isSupporter,
      discordUserId,
    });

    const enforceRefreshRateDocs = this.getEnforceRefreshRateWrites({
      enforcementType: "single-user",
      discordUserId,
      refreshRateSeconds,
    });

    const allWriteDocs = [...enforceWebhookDocs, ...enforceRefreshRateDocs];

    if (isSupporter) {
      const docs = await this.enforceSupporterLimits({
        enforcementType: "single-user",
        discordUserId,
        maxUserFeeds,
      });

      allWriteDocs.push(...docs);
    } else {
      const docs = await this.enforceNonSupporterLimits({
        enforcementType: "single-user",
        discordUserId,
      });

      allWriteDocs.push(...docs);
    }

    if (allWriteDocs.length > 0) {
      await this.userFeedModel.bulkWrite(allWriteDocs);
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
    const enforceWebhookDocs = this.getEnforceWebhookWrites({
      enforcementType: "all-users",
      supporterDiscordUserIds,
    });

    const enforceRefreshRateDocs = this.getEnforceRefreshRateWrites({
      enforcementType: "all-users",
      supporterLimits,
    });

    const [enforceNonSupporterLimitDocs, enforceSupporterLimitDocs] =
      await Promise.all([
        this.enforceNonSupporterLimits({
          enforcementType: "all-users",
          supporterDiscordUserIds,
        }),
        this.enforceSupporterLimits({
          enforcementType: "all-users",
          supporterLimits,
        }),
      ]);

    const writeDocs = [
      ...enforceWebhookDocs,
      ...enforceRefreshRateDocs,
      ...enforceSupporterLimitDocs,
      ...enforceNonSupporterLimitDocs,
    ];

    if (writeDocs.length > 0) {
      await this.userFeedModel.bulkWrite(writeDocs);
    }
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
  ): Promise<UserFeedBulkWriteDocument[]> {
    const defaultMaxUserFeeds = this.supportersService.defaultMaxUserFeeds;

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
          $sort: {
            createdAt: 1,
          },
        },
        {
          $group: {
            _id: "$user.discordUserId",
            disabledFeedIds: {
              $push: {
                $cond: [
                  {
                    $in: [
                      "$disabledCode",
                      [UserFeedDisabledCode.ExceededFeedLimit],
                    ],
                  },
                  "$_id",
                  "$$REMOVE",
                ],
              },
            },
            enabledFeedIds: {
              $push: {
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
                  "$_id",
                  "$$REMOVE",
                ],
              },
            },
          },
        },
      ])
      .cursor();

    const arrayOfFeedIdsToDisable: Types.ObjectId[] = [];
    const arrayOfFeedIdsToEnable: Types.ObjectId[] = [];

    for await (const res of usersWithPotentialFeedsToDisable) {
      const disabledFeedIds = res.disabledFeedIds as Types.ObjectId[];
      const enabledFeedIds = res.enabledFeedIds as Types.ObjectId[];

      const enabledFeedCount = enabledFeedIds.length;

      if (enabledFeedCount > defaultMaxUserFeeds) {
        const toDisable = enabledFeedIds.slice(
          0,
          enabledFeedCount - defaultMaxUserFeeds
        );

        arrayOfFeedIdsToDisable.push(...toDisable);
      } else if (
        enabledFeedCount < defaultMaxUserFeeds &&
        disabledFeedIds.length > 0
      ) {
        const numberOfFeedsToEnable = defaultMaxUserFeeds - enabledFeedCount;
        // Enable the newest ones first
        const toEnable = disabledFeedIds.slice(
          disabledFeedIds.length - numberOfFeedsToEnable
        );

        arrayOfFeedIdsToEnable.push(...toEnable);
      }
    }

    const bulkWriteDocs: UserFeedBulkWriteDocument[] = [];

    if (arrayOfFeedIdsToDisable.length > 0) {
      bulkWriteDocs.push({
        updateMany: {
          filter: {
            _id: {
              $in: arrayOfFeedIdsToDisable,
            },
          },
          update: {
            $set: {
              disabledCode: UserFeedDisabledCode.ExceededFeedLimit,
            },
          },
        },
      });
    }

    if (arrayOfFeedIdsToEnable.length > 0) {
      bulkWriteDocs.push({
        updateMany: {
          filter: {
            _id: {
              $in: arrayOfFeedIdsToEnable,
            },
          },
          update: {
            $unset: {
              disabledCode: "",
            },
          },
        },
      });
    }

    return bulkWriteDocs;
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
  ): Promise<UserFeedBulkWriteDocument[]> {
    const userIds =
      opts.enforcementType === "all-users"
        ? opts.supporterLimits.map((l) => l.discordUserId)
        : [opts.discordUserId];

    if (userIds.length === 0) {
      return [];
    }

    const feedLimitsByUserId: Record<string, number> =
      opts.enforcementType === "all-users"
        ? Object.fromEntries(
            opts.supporterLimits.map(({ discordUserId, maxUserFeeds }) => [
              discordUserId,
              maxUserFeeds,
            ])
          )
        : {
            [opts.discordUserId]: opts.maxUserFeeds,
          };

    const aggregateResult = await this.userFeedModel
      .aggregate([
        {
          $match: {
            "user.discordUserId": {
              $in: userIds,
            },
          },
        },
        {
          $sort: {
            createdAt: 1,
          },
        },
        {
          $group: {
            _id: "$user.discordUserId",
            disabledFeedIds: {
              $push: {
                $cond: [
                  {
                    $in: [
                      "$disabledCode",
                      [UserFeedDisabledCode.ExceededFeedLimit],
                    ],
                  },
                  "$_id",
                  "$$REMOVE",
                ],
              },
            },
            enabledFeedIds: {
              $push: {
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
                  "$_id",
                  "$$REMOVE",
                ],
              },
            },
          },
        },
      ])
      .cursor();

    const arrayOfFeedIdsToDisable: Types.ObjectId[] = [];
    const arrayOfFeedIdsToEnable: Types.ObjectId[] = [];
    const bulkWriteDocs: UserFeedBulkWriteDocument[] = [];

    for await (const res of aggregateResult) {
      const discordUserId = res._id as string;
      const enabledFeedIds = res.enabledFeedIds as Types.ObjectId[];
      const disabledFeedIds = res.disabledFeedIds as Types.ObjectId[];
      const limit = feedLimitsByUserId[discordUserId];

      if (!limit) {
        throw new Error(
          `No feed limit found for user ${discordUserId} while enforcing limits`
        );
      }

      const enabledFeedCount = enabledFeedIds.length;

      if (enabledFeedCount > limit) {
        const toDisable = enabledFeedIds.slice(0, enabledFeedCount - limit);

        arrayOfFeedIdsToDisable.push(...toDisable);
      } else if (enabledFeedCount < limit && disabledFeedIds.length > 0) {
        const numberOfFeedsToEnable = limit - enabledFeedCount;
        // Enable the newest ones first
        const toEnable = disabledFeedIds.slice(
          disabledFeedIds.length - numberOfFeedsToEnable
        );

        arrayOfFeedIdsToEnable.push(...toEnable);
      }
    }

    if (arrayOfFeedIdsToDisable.length > 0) {
      bulkWriteDocs.push({
        updateMany: {
          filter: {
            _id: {
              $in: arrayOfFeedIdsToDisable,
            },
          },
          update: {
            $set: {
              disabledCode: UserFeedDisabledCode.ExceededFeedLimit,
            },
          },
        },
      });
    }

    if (arrayOfFeedIdsToEnable.length > 0) {
      bulkWriteDocs.push({
        updateMany: {
          filter: {
            _id: {
              $in: arrayOfFeedIdsToEnable,
            },
          },
          update: {
            $unset: {
              disabledCode: "",
            },
          },
        },
      });
    }

    return bulkWriteDocs;
  }

  private getEnforceRefreshRateWrites(
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
  ): UserFeedBulkWriteDocument[] {
    const bulkWriteDocs: UserFeedBulkWriteDocument[] = [];
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
      bulkWriteDocs.push({
        updateMany: {
          filter: {
            userRefreshRateSeconds: supporterRefreshRate,
            "user.discordUserId": {
              $nin: supporterDiscordUserIds,
            },
          },
          update: {
            $unset: {
              userRefreshRateSeconds: "",
            },
          },
        },
      });
    } else {
      const { discordUserId, refreshRateSeconds } = opts;

      if (refreshRateSeconds === supporterRefreshRate) {
        // If the user is a supporter, we don't need to do anything
        return bulkWriteDocs;
      }

      bulkWriteDocs.push({
        updateMany: {
          filter: {
            userRefreshRateSeconds: refreshRateSeconds,
            "user.discordUserId": discordUserId,
          },
          update: {
            $unset: {
              userRefreshRateSeconds: "",
            },
          },
        },
      });
    }

    return bulkWriteDocs;
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

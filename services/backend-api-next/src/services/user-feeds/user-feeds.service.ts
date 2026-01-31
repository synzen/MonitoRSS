import { randomUUID } from "crypto";
import type { IUserFeed } from "../../repositories/interfaces/user-feed.types";
import {
  UserFeedDisabledCode,
  UserFeedHealthStatus,
} from "../../repositories/shared/enums";
import { calculateSlotOffsetMs } from "../../shared/utils/fnv1a-hash";
import { getFeedRequestLookupDetails } from "../../shared/utils/get-feed-request-lookup-details";
import type { FeedRequestLookupDetails } from "../../shared/types/feed-request-lookup-details.type";
import {
  GetArticlesResponseRequestStatus,
  DeliveryPreviewMediumInput,
  GetArticlesInput,
} from "../feed-handler/types";
import { getEffectiveRefreshRateSeconds } from "../../shared/utils/get-effective-refresh-rate";
import {
  BannedFeedException,
  FeedFetchTimeoutException,
  NoFeedOnHtmlPageException,
  FeedParseException,
  FeedRequestException,
  FeedInvalidSslCertException,
  FeedLimitReachedException,
  RefreshRateNotAllowedException,
  SourceFeedNotFoundException,
  FeedNotFailedException,
  ManualRequestTooSoonException,
} from "../../shared/exceptions/user-feeds.exceptions";
import logger from "../../infra/logger";
import type {
  UserFeedsServiceDeps,
  GetUserFeedsInput,
  UserFeedListItem,
  UpdateFeedInput,
  CreateUserFeedInput,
  ValidateFeedUrlOutput,
  CheckUrlIsValidOutput,
  GetFeedArticlePropertiesInput,
  GetFeedArticlePropertiesOutput,
  GetFeedArticlesInput,
  GetFeedArticlesOutput,
  CopyUserFeedSettingsInput,
} from "./types";
import { UserFeedCopyableSetting } from "./types";
import type {
  CopySettingsTarget,
  CopyableSettings,
} from "../../repositories/interfaces/user-feed.types";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { Types } from "mongoose";
import { FeedFetcherFetchStatus } from "../feed-fetcher-api/types";
import { UserFeedTargetFeedSelectionType } from "../feed-connections-discord-channels/types";

dayjs.extend(utc);
dayjs.extend(timezone);

const MESSAGE_BROKER_QUEUE_FEED_DELETED = "feed-deleted";

const DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS = [
  UserFeedDisabledCode.ExceededFeedLimit,
  UserFeedDisabledCode.Manual,
];

export class UserFeedsService {
  constructor(private readonly deps: UserFeedsServiceDeps) {}

  async getFeedById(id: string): Promise<IUserFeed | null> {
    return this.deps.userFeedRepository.findById(id);
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
  async getFeedsByUser(
    _userId: string,
    discordUserId: string,
    input: GetUserFeedsInput,
  ): Promise<UserFeedListItem[]> {
    return this.deps.userFeedRepository.getUserFeedsListing({
      discordUserId,
      limit: input.limit,
      offset: input.offset,
      search: input.search,
      sort: input.sort,
      filters: input.filters,
    });
  }

  async getFeedCountByUser(
    _userId: string,
    discordUserId: string,
    input: Omit<GetUserFeedsInput, "offset" | "limit" | "sort">,
  ): Promise<number> {
    return this.deps.userFeedRepository.getUserFeedsCount({
      discordUserId,
      search: input.search,
      filters: input.filters,
    });
  }

  async addFeed(
    {
      discordUserId,
      userAccessToken,
    }: { discordUserId: string; userAccessToken: string },
    { title, url, sourceFeedId }: CreateUserFeedInput,
  ): Promise<IUserFeed> {
    const [
      { maxUserFeeds, maxDailyArticles, refreshRateSeconds },
      user,
      sourceFeedToCopyFrom,
    ] = await Promise.all([
      this.deps.supportersService.getBenefitsOfDiscordUser(discordUserId),
      this.deps.usersService.getOrCreateUserByDiscordId(discordUserId),
      sourceFeedId
        ? this.deps.userFeedRepository.findByIdAndOwnership(
            sourceFeedId,
            discordUserId,
          )
        : null,
    ]);

    if (sourceFeedId && !sourceFeedToCopyFrom) {
      throw new SourceFeedNotFoundException(
        `Feed with ID ${sourceFeedId} not found for user ${discordUserId}`,
      );
    }

    const userId = user.id;

    const feedCount =
      await this.calculateCurrentFeedCountOfDiscordUser(discordUserId);

    if (feedCount >= maxUserFeeds) {
      throw new FeedLimitReachedException("Max feeds reached");
    }

    const tempLookupDetails = getFeedRequestLookupDetails({
      decryptionKey: this.deps.config.BACKEND_API_ENCRYPTION_KEY_HEX,
      feed: {
        url,
        feedRequestLookupKey: randomUUID(),
      },
      user,
    });

    const { finalUrl, enableDateChecks, feedTitle } =
      await this.checkUrlIsValid(url, tempLookupDetails);

    const { connections, ...propertiesToCopy } = sourceFeedToCopyFrom || {};

    const created = await this.deps.userFeedRepository.create({
      ...propertiesToCopy,
      title: title || feedTitle || "Untitled Feed",
      url: finalUrl,
      inputUrl: url,
      user: {
        id: userId,
        discordUserId,
      },
      refreshRateSeconds,
      slotOffsetMs: calculateSlotOffsetMs(finalUrl, refreshRateSeconds),
      maxDailyArticles,
      feedRequestLookupKey: tempLookupDetails?.key,
      dateCheckOptions:
        sourceFeedToCopyFrom?.dateCheckOptions ??
        (enableDateChecks
          ? {
              oldArticleDateDiffMsThreshold: 1000 * 60 * 60 * 24, // 1 day
            }
          : undefined),
    });

    if (connections) {
      for (const c of connections.discordChannels) {
        await this.deps.feedConnectionsDiscordChannelsService.cloneConnection(
          c,
          {
            targetFeedSelectionType: UserFeedTargetFeedSelectionType.Selected,
            name: c.name,
            targetFeedIds: [created.id],
          },
          userAccessToken,
          discordUserId,
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
    },
  ) {
    const sourceFeed = await this.deps.userFeedRepository.findById(feedId);

    if (!sourceFeed) {
      throw new Error(`Feed ${feedId} not found while cloning`);
    }

    const { maxUserFeeds } =
      await this.deps.supportersService.getBenefitsOfDiscordUser(
        sourceFeed.user.discordUserId,
      );

    const feedCount = await this.calculateCurrentFeedCountOfDiscordUser(
      sourceFeed.user.discordUserId,
    );

    if (feedCount >= maxUserFeeds) {
      throw new FeedLimitReachedException("Max feeds reached");
    }

    let inputUrl = sourceFeed.inputUrl;
    let finalUrl = sourceFeed.url;

    if (data?.url && data.url !== sourceFeed.url) {
      const user = await this.deps.usersService.getOrCreateUserByDiscordId(
        sourceFeed.user.discordUserId,
      );

      finalUrl = (
        await this.checkUrlIsValid(
          data.url,
          getFeedRequestLookupDetails({
            feed: sourceFeed,
            user,
            decryptionKey: this.deps.config.BACKEND_API_ENCRYPTION_KEY_HEX,
          }),
        )
      ).finalUrl;
      inputUrl = data.url;
    }

    const created = await this.deps.userFeedRepository.clone({
      sourceFeed,
      overrides: {
        title: data?.title,
        url: finalUrl,
        inputUrl,
      },
    });

    await this.deps.usersService.syncLookupKeys({ feedIds: [created.id] });

    for (const c of sourceFeed.connections.discordChannels) {
      await this.deps.feedConnectionsDiscordChannelsService.cloneConnection(
        c,
        {
          targetFeedSelectionType: UserFeedTargetFeedSelectionType.Selected,
          name: c.name,
          targetFeedIds: [created.id],
        },
        userAccessToken,
        sourceFeed.user.discordUserId,
      );
    }

    return { id: created.id };
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
    sourceFeed: IUserFeed;
    dto: CopyUserFeedSettingsInput;
    discordUserId: string;
  }) {
    const target: CopySettingsTarget = {
      type:
        targetFeedSelectionType === UserFeedTargetFeedSelectionType.All
          ? "all"
          : "selected",
      feedIds: inputTargetFeedIds,
      search: targetFeedSearch,
      excludeFeedId: sourceFeed.id,
      ownerDiscordUserId: discordUserId,
    };

    const copyableSettings: CopyableSettings = {};

    if (settingsToCopy.includes(UserFeedCopyableSetting.PassingComparisons)) {
      copyableSettings.passingComparisons = sourceFeed.passingComparisons;
    }

    if (settingsToCopy.includes(UserFeedCopyableSetting.BlockingComparisons)) {
      copyableSettings.blockingComparisons = sourceFeed.blockingComparisons;
    }

    if (settingsToCopy.includes(UserFeedCopyableSetting.ExternalProperties)) {
      copyableSettings.externalProperties = sourceFeed.externalProperties;
    }

    if (settingsToCopy.includes(UserFeedCopyableSetting.DateChecks)) {
      copyableSettings.dateCheckOptions = sourceFeed.dateCheckOptions;
    }

    if (
      settingsToCopy.includes(UserFeedCopyableSetting.DatePlaceholderSettings)
    ) {
      copyableSettings.formatOptions = {
        ...sourceFeed.formatOptions,
        dateFormat: sourceFeed.formatOptions?.dateFormat,
        dateTimezone: sourceFeed.formatOptions?.dateTimezone,
        dateLocale: sourceFeed.formatOptions?.dateLocale,
      };
    }

    if (settingsToCopy.includes(UserFeedCopyableSetting.RefreshRate)) {
      if (sourceFeed.userRefreshRateSeconds) {
        copyableSettings.userRefreshRateSeconds =
          sourceFeed.userRefreshRateSeconds;
      } else {
        copyableSettings.userRefreshRateSeconds = null;
      }
    }

    if (settingsToCopy.includes(UserFeedCopyableSetting.Connections)) {
      const feedsWithApplicationWebhooks =
        await this.deps.userFeedRepository.findFeedsWithApplicationOwnedWebhooks(
          target,
        );

      await Promise.all(
        feedsWithApplicationWebhooks.map(async (f) => {
          await Promise.all(
            f.connections.discordChannels.map(async (c) => {
              if (c.details.webhook?.isApplicationOwned === true) {
                await this.deps.feedConnectionsDiscordChannelsService.deleteConnection(
                  f.id,
                  c.id,
                );
              }
            }),
          );
        }),
      );

      copyableSettings.connections = sourceFeed.connections;
    }

    await this.deps.userFeedRepository.copySettingsToFeeds({
      target,
      settings: copyableSettings,
    });
  }

  async getFeedRequests({
    feed,
    url,
    query,
  }: {
    feed: IUserFeed;
    url: string;
    query: Record<string, string>;
  }) {
    const lookupDetails = getFeedRequestLookupDetails({
      feed,
      user: await this.deps.usersService.getOrCreateUserByDiscordId(
        feed.user.discordUserId,
      ),
      decryptionKey: this.deps.config.BACKEND_API_ENCRYPTION_KEY_HEX,
    });

    return this.deps.feedFetcherApiService.getRequests({
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
    },
  ) {
    return this.deps.feedHandlerService.getDeliveryLogs(feedId, {
      limit,
      skip,
    });
  }

  async updateFeedById(
    { id, disabledCode }: { id: string; disabledCode?: UserFeedDisabledCode },
    updates: UpdateFeedInput,
  ): Promise<IUserFeed | null> {
    let userBenefits: Awaited<
      ReturnType<typeof this.deps.supportersService.getBenefitsOfDiscordUser>
    > | null = null;

    const feed = await this.deps.userFeedRepository.findById(id);

    if (!feed) {
      throw new Error(`Feed ${id} not found while updating feed`);
    }

    const user = await this.deps.usersService.getOrCreateUserByDiscordId(
      feed.user.discordUserId,
    );

    const useUpdateObject: Record<string, Record<string, unknown>> = {
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
          decryptionKey: this.deps.config.BACKEND_API_ENCRYPTION_KEY_HEX,
        }),
      );
      useUpdateObject.$set!.url = finalUrl;
      useUpdateObject.$set!.inputUrl = updates.url;

      // Recalculate slot offset when URL changes to maintain even distribution
      const effectiveRefreshRate =
        feed.userRefreshRateSeconds ??
        feed.refreshRateSeconds ??
        this.deps.supportersService.defaultRefreshRateSeconds;
      useUpdateObject.$set!.slotOffsetMs = calculateSlotOffsetMs(
        finalUrl,
        effectiveRefreshRate,
      );
    }

    if (updates.disabledCode !== undefined) {
      if (!userBenefits) {
        userBenefits =
          await this.deps.supportersService.getBenefitsOfDiscordUser(
            user.discordUserId,
          );
      }

      if (
        updates.disabledCode === null &&
        disabledCode &&
        DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS.includes(disabledCode)
      ) {
        const currentFeedCount =
          await this.deps.userFeedRepository.countByOwnershipExcludingDisabled(
            user.discordUserId,
            DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS,
          );

        if (userBenefits.maxUserFeeds <= currentFeedCount) {
          throw new FeedLimitReachedException(
            `Cannot enable feed ${id} because user ${user.discordUserId} has reached the feed limit`,
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
        userBenefits =
          await this.deps.supportersService.getBenefitsOfDiscordUser(
            user.discordUserId,
          );
      }

      const { refreshRateSeconds: fastestPossibleRate } = userBenefits;

      if (
        updates.userRefreshRateSeconds === null ||
        updates.userRefreshRateSeconds === fastestPossibleRate
      ) {
        useUpdateObject.$unset!.userRefreshRateSeconds = "";

        // Recalculate slot offset based on the new effective rate
        const newEffectiveRate =
          feed.refreshRateSeconds ??
          this.deps.supportersService.defaultRefreshRateSeconds;
        useUpdateObject.$set!.slotOffsetMs = calculateSlotOffsetMs(
          feed.url,
          newEffectiveRate,
        );
      } else if (updates.userRefreshRateSeconds > 86400) {
        throw new RefreshRateNotAllowedException(
          `Refresh rate is too high. Maximum is 86400 seconds (24 hours).`,
        );
      } else if (updates.userRefreshRateSeconds < fastestPossibleRate) {
        throw new RefreshRateNotAllowedException(
          `Refresh rate is too low. Must be at least ${fastestPossibleRate} seconds.`,
        );
      } else {
        useUpdateObject.$set!.userRefreshRateSeconds =
          updates.userRefreshRateSeconds;

        // Recalculate slot offset based on the new user refresh rate
        useUpdateObject.$set!.slotOffsetMs = calculateSlotOffsetMs(
          feed.url,
          updates.userRefreshRateSeconds,
        );
      }
    }

    const u = await this.deps.userFeedRepository.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
      },
      useUpdateObject,
      {
        new: true,
      },
    );

    if (updates.url) {
      await this.deps.publishMessage(MESSAGE_BROKER_QUEUE_FEED_DELETED, {
        data: { feed: { id } },
      });
    }

    if (
      u &&
      (updates.disabledCode === null ||
        (updates.disabledCode &&
          DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS.includes(
            updates.disabledCode,
          )))
    ) {
      await this.enforceUserFeedLimit(u.user.discordUserId);
    }

    return u;
  }

  async deleteFeedById(id: string): Promise<IUserFeed | null> {
    const feed = await this.deps.userFeedRepository.findById(id);

    if (!feed) {
      return null;
    }

    if (this.deps.feedConnectionsDiscordChannelsService) {
      await Promise.all(
        feed.connections.discordChannels.map((conn) =>
          this.deps.feedConnectionsDiscordChannelsService!.deleteConnection(
            id,
            conn.id,
          ),
        ),
      );
    }

    await this.deps.userFeedRepository.deleteById(id);

    await this.deps.publishMessage(MESSAGE_BROKER_QUEUE_FEED_DELETED, {
      data: { feed: { id } },
    });

    try {
      await this.enforceUserFeedLimit(feed.user.discordUserId);
    } catch (err) {
      logger.error("Failed to enforce user feed limit after deleting feed", {
        feedId: id,
        discordUserId: feed.user.discordUserId,
        error: (err as Error).stack,
      });
    }

    return feed;
  }

  async retryFailedFeed(feedId: string) {
    await this.deps.usersService.syncLookupKeys({
      feedIds: [feedId],
    });
    const feed = await this.deps.userFeedRepository.findById(feedId);

    if (!feed) {
      throw new Error(
        `Feed ${feedId} not found while attempting to retry failed feed`,
      );
    }

    if (
      feed.healthStatus !== UserFeedHealthStatus.Failed &&
      feed.disabledCode !== UserFeedDisabledCode.InvalidFeed
    ) {
      throw new FeedNotFailedException(
        `Feed ${feedId} is not in a failed state, cannot retry it`,
      );
    }

    const user = await this.deps.usersService.getOrCreateUserByDiscordId(
      feed.user.discordUserId,
    );

    const lookupDetails = getFeedRequestLookupDetails({
      feed,
      user,
      decryptionKey: this.deps.config.BACKEND_API_ENCRYPTION_KEY_HEX,
    });

    await this.deps.feedFetcherService.fetchFeed(
      lookupDetails?.url || feed.url,
      lookupDetails,
      {
        fetchOptions: {
          useServiceApi: true,
          useServiceApiCache: false,
          debug: feed.debug,
        },
      },
    );

    return this.deps.userFeedRepository.updateById(feedId, {
      $set: { healthStatus: UserFeedHealthStatus.Ok },
      $unset: { disabledCode: "" },
    });
  }

  async manuallyRequest(feed: IUserFeed) {
    const lastRequestTime = feed.lastManualRequestAt || new Date(0);
    const waitDurationSeconds = getEffectiveRefreshRateSeconds(feed, 10 * 60)!;
    const secondsSinceLastRequest = dayjs().diff(
      dayjs(lastRequestTime),
      "seconds",
    );

    if (secondsSinceLastRequest < waitDurationSeconds) {
      throw new ManualRequestTooSoonException(
        `Feed ${feed.id} was manually requested too soon after the last request`,
        {
          secondsUntilNextRequest:
            waitDurationSeconds - secondsSinceLastRequest,
        },
      );
    }

    const requestDate = new Date();
    const user = await this.deps.usersService.getOrCreateUserByDiscordId(
      feed.user.discordUserId,
    );

    await this.deps.usersService.syncLookupKeys({
      feedIds: [feed.id],
    });
    const lookupDetails = getFeedRequestLookupDetails({
      feed,
      user,
      decryptionKey: this.deps.config.BACKEND_API_ENCRYPTION_KEY_HEX,
    });

    const res = await this.deps.feedFetcherApiService.fetchAndSave(
      lookupDetails?.url || feed.url,
      lookupDetails,
      {
        getCachedResponse: false,
      },
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

    const updateDoc: Record<string, unknown> = {
      $set: {
        lastManualRequestAt: requestDate,
        healthStatus: isRequestSuccessful
          ? UserFeedHealthStatus.Ok
          : feed.healthStatus,
      },
    };

    if (canBeEnabled) {
      updateDoc.$unset = { disabledCode: "" };
    }

    await this.deps.userFeedRepository.findOneAndUpdate(
      { _id: new Types.ObjectId(feed.id) },
      updateDoc,
    );

    return {
      requestStatus: res.requestStatus,
      requestStatusCode:
        res.requestStatus === FeedFetcherFetchStatus.BadStatusCode
          ? res.response?.statusCode
          : undefined,
      getArticlesRequestStatus,
      hasEnabledFeed: canBeEnabled,
    };
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
        externalProperties: feed.externalProperties?.map((p) => ({
          ...p,
        })),
      },
    };

    const user = await this.deps.usersService.getOrCreateUserByDiscordId(
      feed.user.discordUserId,
    );

    const { articles, requestStatus } =
      await this.deps.feedHandlerService.getArticles(
        input,
        getFeedRequestLookupDetails({
          feed,
          user,
          decryptionKey: this.deps.config.BACKEND_API_ENCRYPTION_KEY_HEX,
        }),
      );

    const properties = Array.from(
      new Set(articles.map((article) => Object.keys(article)).flat()),
    ).sort();

    return {
      requestStatus,
      properties,
    };
  }
  async getFeedDailyLimit(feed: IUserFeed) {
    const { articleRateLimits } =
      await this.deps.supportersService.getBenefitsOfDiscordUser(
        feed.user.discordUserId,
      );

    const dailyLimit = articleRateLimits.find(
      (limit) => limit.timeWindowSeconds === 86400,
    );

    if (!dailyLimit) {
      throw new Error(
        `Daily limit was not found for feed ${feed.id} whose owner is ${feed.user.discordUserId}`,
      );
    }

    const currentProgress = await this.deps.feedHandlerService.getDeliveryCount(
      {
        feedId: feed.id,
        timeWindowSec: 86400,
      },
    );

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
    includeHtmlInErrors,
  }: GetFeedArticlesInput): Promise<GetFeedArticlesOutput> {
    const user =
      await this.deps.usersService.getOrCreateUserByDiscordId(discordUserId);

    return this.deps.feedHandlerService.getArticles(
      {
        url,
        limit,
        random,
        filters,
        skip: skip || 0,
        selectProperties,
        selectPropertyTypes,
        includeHtmlInErrors,
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
        decryptionKey: this.deps.config.BACKEND_API_ENCRYPTION_KEY_HEX,
      }),
    );
  }

  async bulkDelete(
    feedIds: string[],
  ): Promise<Array<{ id: string; deleted: boolean }>> {
    const feeds = await this.deps.userFeedRepository.findByIds(feedIds);
    const foundIds = new Set(feeds.map((f) => f.id));

    if (this.deps.feedConnectionsDiscordChannelsService) {
      const deletePromises = feeds.flatMap((feed) =>
        feed.connections.discordChannels.map((conn) =>
          this.deps
            .feedConnectionsDiscordChannelsService!.deleteConnection(
              feed.id,
              conn.id,
            )
            .catch((err) => {
              logger.error(
                "Failed to delete feed connection during bulk delete",
                {
                  feedId: feed.id,
                  connectionId: conn.id,
                  error: (err as Error).stack,
                },
              );
            }),
        ),
      );
      await Promise.all(deletePromises);
    }

    if (foundIds.size > 0) {
      await this.deps.userFeedRepository.deleteByIds(feeds.map((f) => f.id));
    }

    const userIds = [...new Set(feeds.map((f) => f.user.discordUserId))];

    try {
      for (const userId of userIds) {
        await this.enforceUserFeedLimit(userId);
      }
    } catch (err) {
      logger.error("Failed to enforce user feed limits after bulk delete", {
        userIds,
        error: (err as Error).stack,
      });
    }

    for (const feed of feeds) {
      await this.deps.publishMessage(MESSAGE_BROKER_QUEUE_FEED_DELETED, {
        data: { feed: { id: feed.id } },
      });
    }

    return feedIds.map((id) => ({
      id,
      deleted: foundIds.has(id),
    }));
  }

  async bulkDisable(
    feedIds: string[],
  ): Promise<Array<{ id: string; disabled: boolean }>> {
    const [eligibleFeeds, userIds] = await Promise.all([
      this.deps.userFeedRepository.findEligibleFeedsForDisable(
        feedIds,
        DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS,
      ),
      this.deps.userFeedRepository.findUserIdsByFeedIds(feedIds),
    ]);
    const eligibleIds = new Set(eligibleFeeds.map((f) => f.id));

    if (eligibleIds.size > 0) {
      await this.deps.userFeedRepository.updateManyByFilter(
        { _id: { $in: Array.from(eligibleIds) } },
        { $set: { disabledCode: UserFeedDisabledCode.Manual } },
      );
    }

    try {
      for (const userId of userIds) {
        await this.enforceUserFeedLimit(userId);
      }
    } catch (err) {
      logger.error("Failed to enforce user feed limits after bulk disable", {
        userIds,
        error: (err as Error).stack,
      });
    }

    return feedIds.map((id) => ({
      id,
      disabled: eligibleIds.has(id),
    }));
  }

  async bulkEnable(
    feedIds: string[],
  ): Promise<Array<{ id: string; enabled: boolean }>> {
    const [eligibleFeeds, userIds] = await Promise.all([
      this.deps.userFeedRepository.findEligibleFeedsForEnable(feedIds),
      this.deps.userFeedRepository.findUserIdsByFeedIds(feedIds),
    ]);
    const eligibleIds = new Set(eligibleFeeds.map((f) => f.id));

    if (eligibleIds.size > 0) {
      await this.deps.userFeedRepository.updateManyByFilter(
        { _id: { $in: Array.from(eligibleIds) } },
        { $unset: { disabledCode: 1 } },
      );
    }

    try {
      for (const userId of userIds) {
        await this.enforceUserFeedLimit(userId);
      }
    } catch (err) {
      logger.error("Failed to enforce user feed limits after bulk enable", {
        userIds,
        error: (err as Error).stack,
      });
    }

    return feedIds.map((id) => ({
      id,
      enabled: eligibleIds.has(id),
    }));
  }

  async validateFeedUrl(
    opts: { discordUserId: string },
    input: { url: string },
  ): Promise<ValidateFeedUrlOutput> {
    const { discordUserId } = opts;
    const { url } = input;

    const user =
      await this.deps.usersService.getOrCreateUserByDiscordId(discordUserId);

    const lookupDetails = getFeedRequestLookupDetails({
      feed: { url, feedRequestLookupKey: undefined },
      user: {
        externalCredentials: user.externalCredentials?.map((c) => ({
          type: c.type,
          data: c.data,
        })),
      },
      decryptionKey: this.deps.config.BACKEND_API_ENCRYPTION_KEY_HEX,
    });

    const { finalUrl, feedTitle } = await this.checkUrlIsValid(
      url,
      lookupDetails,
    );

    if (finalUrl !== url) {
      return {
        resolvedToUrl: finalUrl,
      };
    }

    return { resolvedToUrl: null, feedTitle };
  }

  async deduplicateFeedUrls(
    discordUserId: string,
    urls: string[],
  ): Promise<string[]> {
    const existingFeeds = await this.deps.userFeedRepository.findByUrls(
      discordUserId,
      urls,
    );
    const existingUrls = new Set(existingFeeds.map((f) => f.url));

    return urls.filter((url) => !existingUrls.has(url));
  }

  async calculateCurrentFeedCountOfDiscordUser(
    discordUserId: string,
  ): Promise<number> {
    return this.deps.userFeedRepository.countByOwnership(discordUserId);
  }

  async enforceUserFeedLimit(discordUserId: string): Promise<void> {
    const { isSupporter, refreshRateSeconds, maxUserFeeds } =
      await this.deps.supportersService.getBenefitsOfDiscordUser(discordUserId);

    await this.deps.userFeedRepository.enforceWebhookConnections({
      type: "single-user",
      allowWebhooks: isSupporter,
      discordUserId,
    });

    await this.deps.userFeedRepository.enforceRefreshRates(
      {
        type: "single-user",
        discordUserId,
        refreshRateSeconds,
      },
      this.deps.supportersService.defaultSupporterRefreshRateSeconds,
    );

    const { feedIdsToDisable, feedIdsToEnable } = isSupporter
      ? await this.collectFeedIdsForSupporterLimits({
          type: "single-user",
          discordUserId,
          maxUserFeeds,
        })
      : await this.collectFeedIdsForNonSupporterLimits({
          type: "single-user",
          discordUserId,
        });

    await this.deps.userFeedRepository.disableFeedsByIds(
      feedIdsToDisable,
      UserFeedDisabledCode.ExceededFeedLimit,
    );
    await this.deps.userFeedRepository.enableFeedsByIds(feedIdsToEnable);
  }

  async enforceAllUserFeedLimits(
    supporterLimits: Array<{
      discordUserId: string;
      maxUserFeeds: number;
      refreshRateSeconds: number;
    }>,
  ) {
    const supporterDiscordUserIds = supporterLimits.map(
      ({ discordUserId }) => discordUserId,
    );

    await this.deps.userFeedRepository.enforceWebhookConnections({
      type: "all-users",
      supporterDiscordUserIds,
    });

    await this.deps.userFeedRepository.enforceRefreshRates(
      {
        type: "all-users",
        supporterLimits,
      },
      this.deps.supportersService.defaultSupporterRefreshRateSeconds,
    );

    const [nonSupporterLimits, supporterLimitResults] = await Promise.all([
      this.collectFeedIdsForNonSupporterLimits({
        type: "all-users",
        supporterDiscordUserIds,
      }),
      this.collectFeedIdsForSupporterLimits({
        type: "all-users",
        supporterLimits,
      }),
    ]);

    const feedIdsToDisable = [
      ...nonSupporterLimits.feedIdsToDisable,
      ...supporterLimitResults.feedIdsToDisable,
    ];
    const feedIdsToEnable = [
      ...nonSupporterLimits.feedIdsToEnable,
      ...supporterLimitResults.feedIdsToEnable,
    ];

    await this.deps.userFeedRepository.disableFeedsByIds(
      feedIdsToDisable,
      UserFeedDisabledCode.ExceededFeedLimit,
    );
    await this.deps.userFeedRepository.enableFeedsByIds(feedIdsToEnable);
  }

  async getDeliveryPreview({
    feed,
    skip,
    limit,
  }: {
    feed: IUserFeed;
    skip: number;
    limit: number;
  }) {
    const [user, { maxDailyArticles }] = await Promise.all([
      this.deps.usersService.getOrCreateUserByDiscordId(
        feed.user.discordUserId,
      ),
      this.deps.supportersService.getBenefitsOfDiscordUser(
        feed.user.discordUserId,
      ),
    ]);

    const lookupDetails = getFeedRequestLookupDetails({
      feed,
      user,
      decryptionKey: this.deps.config.BACKEND_API_ENCRYPTION_KEY_HEX,
    });

    const mediums = this.mapConnectionsToMediums(feed);

    const result = await this.deps.feedHandlerService.getDeliveryPreview({
      feed: {
        id: feed.id,
        url: feed.url,
        blockingComparisons: feed.blockingComparisons || [],
        passingComparisons: feed.passingComparisons || [],
        dateChecks: feed.dateCheckOptions,
        formatOptions: feed.formatOptions,
        externalProperties: feed.externalProperties?.map((ep) => ({
          sourceField: ep.sourceField,
          label: ep.label,
          cssSelector: ep.cssSelector,
        })),
        requestLookupDetails: lookupDetails
          ? {
              key: lookupDetails.key,
              url: lookupDetails.url,
              headers: lookupDetails.headers,
            }
          : null,
        refreshRateSeconds: getEffectiveRefreshRateSeconds(feed),
      },
      mediums,
      articleDayLimit: feed.maxDailyArticles ?? maxDailyArticles,
      skip,
      limit,
    });

    return { result };
  }

  private generateFeedRequestLookupKey(): string {
    return randomUUID();
  }

  private async checkUrlIsValid(
    url: string,
    lookupDetails: FeedRequestLookupDetails | null,
  ): Promise<CheckUrlIsValidOutput> {
    const getArticlesResponse = await this.deps.feedHandlerService.getArticles(
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
      lookupDetails,
    );

    const {
      requestStatus,
      url: finalUrl,
      attemptedToResolveFromHtml,
      articles,
      feedTitle,
    } = getArticlesResponse;

    if (requestStatus === GetArticlesResponseRequestStatus.Success) {
      const bannedRecord = await this.deps.feedsService.getBannedFeedDetails(
        finalUrl || url,
        "",
      );

      if (bannedRecord) {
        throw new BannedFeedException();
      }

      return {
        finalUrl: finalUrl || url,
        enableDateChecks: !!articles[0]?.date,
        feedTitle: feedTitle || undefined,
      };
    } else if (requestStatus === GetArticlesResponseRequestStatus.TimedOut) {
      throw new FeedFetchTimeoutException(`Feed fetch timed out`);
    } else if (requestStatus === GetArticlesResponseRequestStatus.ParseError) {
      if (attemptedToResolveFromHtml) {
        throw new NoFeedOnHtmlPageException(`No feed found on HTML page`);
      }

      throw new FeedParseException(
        `Feed host failed to return a valid, parseable feed`,
      );
    } else if (
      requestStatus === GetArticlesResponseRequestStatus.BadStatusCode
    ) {
      const statusCode = getArticlesResponse.response?.statusCode;

      if (!statusCode) {
        throw new FeedRequestException(`Non-200 status code returned`);
      }

      this.deps.feedFetcherService.handleStatusCode(statusCode);
    } else if (requestStatus === GetArticlesResponseRequestStatus.FetchError) {
      throw new FeedRequestException(`Feed fetch failed`);
    } else if (
      requestStatus === GetArticlesResponseRequestStatus.InvalidSslCertificate
    ) {
      throw new FeedInvalidSslCertException(
        "Issue encountered with SSL certificate",
      );
    }

    throw new Error(`Unhandled request status ${requestStatus}`);
  }

  private async collectFeedIdsForSupporterLimits(
    opts:
      | {
          type: "all-users";
          supporterLimits: Array<{
            discordUserId: string;
            maxUserFeeds: number;
          }>;
        }
      | {
          type: "single-user";
          discordUserId: string;
          maxUserFeeds: number;
        },
  ): Promise<{ feedIdsToDisable: string[]; feedIdsToEnable: string[] }> {
    const userIds =
      opts.type === "all-users"
        ? opts.supporterLimits.map((l) => l.discordUserId)
        : [opts.discordUserId];

    if (userIds.length === 0) {
      return { feedIdsToDisable: [], feedIdsToEnable: [] };
    }

    const feedLimitsByUserId: Record<string, number> =
      opts.type === "all-users"
        ? Object.fromEntries(
            opts.supporterLimits.map(({ discordUserId, maxUserFeeds }) => [
              discordUserId,
              maxUserFeeds,
            ]),
          )
        : {
            [opts.discordUserId]: opts.maxUserFeeds,
          };

    const feedIdsToDisable: string[] = [];
    const feedIdsToEnable: string[] = [];

    const results =
      this.deps.userFeedRepository.getFeedsGroupedByUserForLimitEnforcement({
        type: "include",
        discordUserIds: userIds,
      });

    for await (const res of results) {
      const { discordUserId, enabledFeedIds, disabledFeedIds } = res;
      const limit = feedLimitsByUserId[discordUserId];

      if (!limit) {
        throw new Error(
          `No feed limit found for user ${discordUserId} while enforcing limits`,
        );
      }

      const enabledFeedCount = enabledFeedIds.length;

      if (enabledFeedCount > limit) {
        const toDisable = enabledFeedIds.slice(0, enabledFeedCount - limit);
        feedIdsToDisable.push(...toDisable);
      } else if (enabledFeedCount < limit && disabledFeedIds.length > 0) {
        const numberOfFeedsToEnable = limit - enabledFeedCount;
        const toEnable = disabledFeedIds.slice(
          Math.max(0, disabledFeedIds.length - numberOfFeedsToEnable),
        );
        feedIdsToEnable.push(...toEnable);
      }
    }

    return { feedIdsToDisable, feedIdsToEnable };
  }

  private async collectFeedIdsForNonSupporterLimits(
    opts:
      | {
          type: "all-users";
          supporterDiscordUserIds: Array<string>;
        }
      | {
          type: "single-user";
          discordUserId: string;
        },
  ): Promise<{ feedIdsToDisable: string[]; feedIdsToEnable: string[] }> {
    const defaultMaxUserFeeds = this.deps.supportersService.defaultMaxUserFeeds;

    const results =
      opts.type === "single-user"
        ? this.deps.userFeedRepository.getFeedsGroupedByUserForLimitEnforcement(
            {
              type: "include",
              discordUserIds: [opts.discordUserId],
            },
          )
        : this.deps.userFeedRepository.getFeedsGroupedByUserForLimitEnforcement(
            {
              type: "exclude",
              discordUserIds: opts.supporterDiscordUserIds,
            },
          );

    const feedIdsToDisable: string[] = [];
    const feedIdsToEnable: string[] = [];

    for await (const res of results) {
      const { enabledFeedIds, disabledFeedIds } = res;

      const enabledFeedCount = enabledFeedIds.length;

      if (enabledFeedCount > defaultMaxUserFeeds) {
        const toDisable = enabledFeedIds.slice(
          0,
          enabledFeedCount - defaultMaxUserFeeds,
        );
        feedIdsToDisable.push(...toDisable);
      } else if (
        enabledFeedCount < defaultMaxUserFeeds &&
        disabledFeedIds.length > 0
      ) {
        const numberOfFeedsToEnable = defaultMaxUserFeeds - enabledFeedCount;
        const toEnable = disabledFeedIds.slice(
          Math.max(0, disabledFeedIds.length - numberOfFeedsToEnable),
        );
        feedIdsToEnable.push(...toEnable);
      }
    }

    return { feedIdsToDisable, feedIdsToEnable };
  }

  private mapConnectionsToMediums(
    feed: IUserFeed,
  ): DeliveryPreviewMediumInput[] {
    const mediums: DeliveryPreviewMediumInput[] = [];

    const connections = feed.connections?.discordChannels || [];

    for (const conn of connections) {
      if (conn.disabledCode) {
        continue;
      }

      mediums.push({
        id: conn.id,
        rateLimits: conn.rateLimits?.map((rl) => ({
          limit: rl.limit,
          timeWindowSeconds: rl.timeWindowSeconds,
        })),
        filters: conn.filters?.expression
          ? { expression: conn.filters.expression }
          : undefined,
      });
    }

    return mediums;
  }
}

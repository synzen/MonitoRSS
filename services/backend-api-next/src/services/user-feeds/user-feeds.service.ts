import { randomUUID } from "crypto";
import type {
  IUserFeed,
  UserFeedBulkWriteOperation,
} from "../../repositories/interfaces/user-feed.types";
import {
  FeedConnectionDisabledCode,
  UserFeedDisabledCode,
} from "../../repositories/shared/enums";
import { calculateSlotOffsetMs } from "../../shared/utils/fnv1a-hash";
import { getFeedRequestLookupDetails } from "../../shared/utils/get-feed-request-lookup-details";
import type { FeedRequestLookupDetails } from "../../shared/types/feed-request-lookup-details.type";
import {
  GetArticlesResponseRequestStatus,
  DeliveryPreviewMediumInput,
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
  FeedTooManyRequestsException,
  FeedUnauthorizedException,
  FeedForbiddenException,
  FeedNotFoundException,
  FeedInternalErrorException,
  RefreshRateNotAllowedException,
  SourceFeedNotFoundException,
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
} from "./types";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

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
    opts: { discordUserId: string; userAccessToken: string },
    input: CreateUserFeedInput,
  ): Promise<IUserFeed> {
    const { discordUserId } = opts;
    const { url, title, sourceFeedId } = input;

    const [benefits, user, sourceFeed] = await Promise.all([
      this.deps.supportersService.getBenefitsOfDiscordUser(discordUserId),
      this.deps.usersService.getOrCreateUserByDiscordId(discordUserId),
      sourceFeedId
        ? this.deps.userFeedRepository.findByIdAndOwnership(
            sourceFeedId,
            discordUserId,
          )
        : null,
    ]);

    if (sourceFeedId && !sourceFeed) {
      throw new SourceFeedNotFoundException(
        `Feed with ID ${sourceFeedId} not found for user ${discordUserId}`,
      );
    }

    const currentFeedCount =
      await this.calculateCurrentFeedCountOfDiscordUser(discordUserId);

    if (currentFeedCount >= benefits.maxUserFeeds) {
      throw new FeedLimitReachedException("Max feeds reached");
    }

    const feedRequestLookupKey = this.generateFeedRequestLookupKey();

    const lookupDetails = getFeedRequestLookupDetails({
      feed: { url, feedRequestLookupKey },
      user: {
        externalCredentials: user.externalCredentials?.map((c) => ({
          type: c.type,
          data: c.data,
        })),
      },
      decryptionKey: this.deps.config.BACKEND_API_ENCRYPTION_KEY_HEX,
    });

    const { finalUrl, enableDateChecks, feedTitle } =
      await this.checkUrlIsValid(url, lookupDetails);

    const slotOffsetMs = calculateSlotOffsetMs(
      finalUrl,
      benefits.refreshRateSeconds,
    );

    const feed = await this.deps.userFeedRepository.create({
      title: title || feedTitle || "Untitled Feed",
      url: finalUrl,
      user: { discordUserId },
    });

    const $set: Record<string, unknown> = {
      inputUrl: url,
      refreshRateSeconds: benefits.refreshRateSeconds,
      maxDailyArticles: benefits.maxDailyArticles,
      slotOffsetMs,
      feedRequestLookupKey,
    };

    if (enableDateChecks) {
      $set.dateCheckOptions = {
        oldArticleDateDiffMsThreshold: 1000 * 60 * 60 * 24,
      };
    }

    if (sourceFeed) {
      if (sourceFeed.passingComparisons?.length) {
        $set.passingComparisons = sourceFeed.passingComparisons;
      }
      if (sourceFeed.blockingComparisons?.length) {
        $set.blockingComparisons = sourceFeed.blockingComparisons;
      }
      if (sourceFeed.formatOptions) {
        $set.formatOptions = sourceFeed.formatOptions;
      }
      if (sourceFeed.dateCheckOptions) {
        $set.dateCheckOptions = sourceFeed.dateCheckOptions;
      }
      if (sourceFeed.externalProperties?.length) {
        $set.externalProperties = sourceFeed.externalProperties;
      }
    }

    const updatedFeed = await this.deps.userFeedRepository.updateById(feed.id, {
      $set,
    });

    return updatedFeed || feed;
  }

  private generateFeedRequestLookupKey(): string {
    return randomUUID();
  }

  async updateFeedById(
    opts: { id: string; discordUserId: string },
    updates: UpdateFeedInput,
  ): Promise<IUserFeed | null> {
    const { id, discordUserId } = opts;

    const feed = await this.deps.userFeedRepository.findById(id);
    if (!feed) {
      throw new Error(`Feed ${id} not found while updating feed`);
    }

    const $set: Record<string, unknown> = {};
    const $unset: Record<string, unknown> = {};

    if (updates.title !== undefined) {
      $set.title = updates.title;
    }

    if (updates.passingComparisons !== undefined) {
      $set.passingComparisons = updates.passingComparisons;
    }

    if (updates.blockingComparisons !== undefined) {
      $set.blockingComparisons = updates.blockingComparisons;
    }

    if (updates.externalProperties !== undefined) {
      $set.externalProperties = updates.externalProperties;
    }

    if (updates.formatOptions !== undefined) {
      $set.formatOptions = updates.formatOptions;
    }

    if (updates.dateCheckOptions !== undefined) {
      $set.dateCheckOptions = updates.dateCheckOptions;
    }

    if (updates.shareManageOptions !== undefined) {
      $set.shareManageOptions = updates.shareManageOptions;
    }

    if (updates.disabledCode !== undefined) {
      const currentlyDisabled = !!feed.disabledCode;
      const wantToDisable =
        updates.disabledCode === UserFeedDisabledCode.Manual;
      const wantToEnable = updates.disabledCode === null;

      if (wantToDisable && !currentlyDisabled) {
        $set.disabledCode = UserFeedDisabledCode.Manual;
      } else if (
        wantToEnable &&
        DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS.includes(
          feed.disabledCode as UserFeedDisabledCode,
        )
      ) {
        if (feed.disabledCode === UserFeedDisabledCode.ExceededFeedLimit) {
          const benefits =
            await this.deps.supportersService.getBenefitsOfDiscordUser(
              discordUserId,
            );
          const enabledFeedCount =
            await this.deps.userFeedRepository.countByOwnershipExcludingDisabled(
              discordUserId,
              DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS,
            );

          if (enabledFeedCount >= benefits.maxUserFeeds) {
            throw new FeedLimitReachedException(
              `Cannot enable feed ${id} because user ${discordUserId} has reached the feed limit`,
            );
          }
        }
        $unset.disabledCode = "";
      }
    }

    if (updates.userRefreshRateSeconds !== undefined) {
      const benefits =
        await this.deps.supportersService.getBenefitsOfDiscordUser(
          discordUserId,
        );

      if (
        updates.userRefreshRateSeconds === null ||
        updates.userRefreshRateSeconds === benefits.refreshRateSeconds
      ) {
        $unset.userRefreshRateSeconds = "";
        const newEffectiveRate =
          feed.refreshRateSeconds ??
          this.deps.supportersService.defaultRefreshRateSeconds;
        $set.slotOffsetMs = calculateSlotOffsetMs(feed.url, newEffectiveRate);
      } else if (updates.userRefreshRateSeconds > 86400) {
        throw new RefreshRateNotAllowedException(
          `Refresh rate is too high. Maximum is 86400 seconds (24 hours).`,
        );
      } else if (updates.userRefreshRateSeconds < benefits.refreshRateSeconds) {
        throw new RefreshRateNotAllowedException(
          `Refresh rate is too low. Must be at least ${benefits.refreshRateSeconds} seconds.`,
        );
      } else {
        $set.userRefreshRateSeconds = updates.userRefreshRateSeconds;
        $set.slotOffsetMs = calculateSlotOffsetMs(
          feed.url,
          updates.userRefreshRateSeconds,
        );
      }
    }

    if (updates.url !== undefined && updates.url !== feed.url) {
      const user =
        await this.deps.usersService.getOrCreateUserByDiscordId(discordUserId);

      const lookupDetails = getFeedRequestLookupDetails({
        feed: {
          url: updates.url,
          feedRequestLookupKey: feed.feedRequestLookupKey,
        },
        user: {
          externalCredentials: user.externalCredentials?.map((c) => ({
            type: c.type,
            data: c.data,
          })),
        },
        decryptionKey: this.deps.config.BACKEND_API_ENCRYPTION_KEY_HEX,
      });

      const { finalUrl, enableDateChecks } = await this.checkUrlIsValid(
        updates.url,
        lookupDetails,
      );

      $set.url = finalUrl;

      if (updates.url !== finalUrl) {
        $set.inputUrl = updates.url;
      } else {
        $unset.inputUrl = "";
      }

      const effectiveRefreshRate =
        feed.userRefreshRateSeconds ||
        (
          await this.deps.supportersService.getBenefitsOfDiscordUser(
            discordUserId,
          )
        ).refreshRateSeconds;

      $set.slotOffsetMs = calculateSlotOffsetMs(finalUrl, effectiveRefreshRate);

      await this.deps.publishMessage(MESSAGE_BROKER_QUEUE_FEED_DELETED, {
        data: { feed: { id } },
      });
    }

    const updateDoc: Record<string, unknown> = {};
    if (Object.keys($set).length > 0) {
      updateDoc.$set = $set;
    }
    if (Object.keys($unset).length > 0) {
      updateDoc.$unset = $unset;
    }

    if (Object.keys(updateDoc).length === 0) {
      return feed;
    }

    const updatedFeed = await this.deps.userFeedRepository.updateById(
      id,
      updateDoc,
    );

    if (updates.disabledCode !== undefined) {
      await this.enforceUserFeedLimit(discordUserId);
    }

    return updatedFeed;
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
    const feeds = await this.deps.userFeedRepository.findByIds(feedIds);
    const eligibleFeeds = feeds.filter(
      (f) =>
        !f.disabledCode ||
        DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS.includes(
          f.disabledCode as UserFeedDisabledCode,
        ),
    );
    const eligibleIds = new Set(eligibleFeeds.map((f) => f.id));

    if (eligibleIds.size > 0) {
      await this.deps.userFeedRepository.updateManyByFilter(
        { _id: { $in: Array.from(eligibleIds) } },
        { $set: { disabledCode: UserFeedDisabledCode.Manual } },
      );
    }

    const userIds = [...new Set(feeds.map((f) => f.user.discordUserId))];
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
    const feeds = await this.deps.userFeedRepository.findByIds(feedIds);
    const eligibleFeeds = feeds.filter(
      (f) => f.disabledCode === UserFeedDisabledCode.Manual,
    );
    const eligibleIds = new Set(eligibleFeeds.map((f) => f.id));

    if (eligibleIds.size > 0) {
      await this.deps.userFeedRepository.updateManyByFilter(
        { _id: { $in: Array.from(eligibleIds) } },
        { $unset: { disabledCode: 1 } },
      );
    }

    const userIds = [...new Set(feeds.map((f) => f.user.discordUserId))];
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

    const urlChanged = finalUrl !== url;

    return {
      resolvedToUrl: urlChanged ? finalUrl : null,
      feedTitle: !urlChanged ? feedTitle || undefined : undefined,
    };
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
      await this.deps.userFeedRepository.bulkWrite(allWriteDocs);
    }
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
      await this.deps.userFeedRepository.bulkWrite(writeDocs);
    }
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

      this.handleStatusCode(statusCode);
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

  private handleStatusCode(code: number): void {
    if (code === 200) {
      return;
    }

    if (code === 429) {
      throw new FeedTooManyRequestsException();
    } else if (code === 401) {
      throw new FeedUnauthorizedException();
    } else if (code === 403) {
      throw new FeedForbiddenException();
    } else if (code === 404) {
      throw new FeedNotFoundException();
    } else if (code >= 500) {
      throw new FeedInternalErrorException();
    } else {
      throw new FeedRequestException(`Non-200 status code (${code})`);
    }
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
        },
  ): UserFeedBulkWriteOperation[] {
    const bulkWriteOps: UserFeedBulkWriteOperation[] = [];

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
            $unset: {
              "connections.discordChannels.$[].disabledCode": "",
            },
          },
        },
      });
    }

    return bulkWriteOps;
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
        },
  ) {
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
            ]),
          )
        : {
            [opts.discordUserId]: opts.maxUserFeeds,
          };

    const feedIdsToDisable: string[] = [];
    const feedIdsToEnable: string[] = [];
    const bulkWriteDocs = [];

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

    if (feedIdsToDisable.length > 0) {
      bulkWriteDocs.push({
        updateMany: {
          filter: {
            _id: { $in: feedIdsToDisable },
          },
          update: {
            $set: {
              disabledCode: UserFeedDisabledCode.ExceededFeedLimit,
            },
          },
        },
      });
    }

    if (feedIdsToEnable.length > 0) {
      bulkWriteDocs.push({
        updateMany: {
          filter: {
            _id: { $in: feedIdsToEnable },
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

  private async enforceNonSupporterLimits(
    opts:
      | {
          enforcementType: "all-users";
          supporterDiscordUserIds: Array<string>;
        }
      | {
          enforcementType: "single-user";
          discordUserId: string;
        },
  ) {
    const defaultMaxUserFeeds = this.deps.supportersService.defaultMaxUserFeeds;

    const results =
      opts.enforcementType === "single-user"
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

    const bulkWriteDocs = [];

    if (feedIdsToDisable.length > 0) {
      bulkWriteDocs.push({
        updateMany: {
          filter: {
            _id: { $in: feedIdsToDisable },
          },
          update: {
            $set: {
              disabledCode: UserFeedDisabledCode.ExceededFeedLimit,
            },
          },
        },
      });
    }

    if (feedIdsToEnable.length > 0) {
      bulkWriteDocs.push({
        updateMany: {
          filter: {
            _id: { $in: feedIdsToEnable },
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
        },
  ): UserFeedBulkWriteOperation[] {
    const bulkWriteDocs: UserFeedBulkWriteOperation[] = [];
    // Unset the lower user refresh rate seconds for users who are not supporters
    const supporterRefreshRate =
      this.deps.supportersService.defaultSupporterRefreshRateSeconds;

    if (opts.enforcementType === "all-users") {
      const supporterDiscordUserIds = opts.supporterLimits
        .filter(
          ({ refreshRateSeconds }) =>
            refreshRateSeconds === supporterRefreshRate,
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
            userRefreshRateSeconds: supporterRefreshRate,
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

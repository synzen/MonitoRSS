import type { IUserFeed } from "../../repositories/interfaces/user-feed.types";
import {
  FeedConnectionDisabledCode,
  UserFeedDisabledCode,
  UserFeedHealthStatus,
  UserFeedManagerStatus,
} from "../../repositories/shared/enums";
import { calculateSlotOffsetMs } from "../../shared/utils/fnv1a-hash";
import { getFeedRequestLookupDetails } from "../../shared/utils/get-feed-request-lookup-details";
import type { FeedRequestLookupDetails } from "../../shared/types/feed-request-lookup-details.type";
import { GetArticlesResponseRequestStatus } from "../feed-handler/types";
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
} from "../../shared/exceptions/user-feeds.exceptions";
import type {
  UserFeedsServiceDeps,
  GetUserFeedsInput,
  GetUserFeedsInputSortKey,
  UserFeedListItem,
  UpdateFeedInput,
  CreateUserFeedInput,
  ValidateFeedUrlOutput,
  CheckUrlIsValidOutput,
} from "./types";
import { UserFeedComputedStatus } from "./types";

const MESSAGE_BROKER_QUEUE_FEED_DELETED = "feed-deleted";

const BAD_USER_FEED_CODES = Object.values(UserFeedDisabledCode).filter(
  (c) => c !== UserFeedDisabledCode.Manual
);

const BAD_CONNECTION_CODES = Object.values(FeedConnectionDisabledCode).filter(
  (c) => c !== FeedConnectionDisabledCode.Manual
);

const DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS = [
  UserFeedDisabledCode.ExceededFeedLimit,
  UserFeedDisabledCode.Manual,
];

export class UserFeedsService {
  constructor(private readonly deps: UserFeedsServiceDeps) {}

  async getFeedById(id: string): Promise<IUserFeed | null> {
    return this.deps.userFeedRepository.findById(id);
  }

  async getFeedsByUser(
    userId: string,
    discordUserId: string,
    input: GetUserFeedsInput
  ): Promise<UserFeedListItem[]> {
    const { limit = 10, offset = 0, search, sort, filters } = input;
    const useSort = sort || ("-createdAt" as GetUserFeedsInputSortKey);

    const sortSplit = useSort.split("-");
    const sortDirection = useSort.startsWith("-") ? -1 : 1;
    const sortKey = sortSplit[sortSplit.length - 1];

    const pipeline = this.generateGetFeedsAggregatePipeline(
      discordUserId,
      userId,
      { search, filters }
    );

    pipeline.push(
      {
        $addFields: {
          refreshRateSeconds: {
            $ifNull: ["$userRefreshRateSeconds", "$refreshRateSeconds"],
          },
        },
      },
      { $sort: { [sortKey]: sortDirection } },
      { $skip: offset },
      { $limit: limit },
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
          refreshRateSeconds: 1,
        },
      }
    );

    const results = await this.deps.userFeedRepository.aggregate<{
      _id: string;
      title: string;
      url: string;
      inputUrl?: string;
      healthStatus: string;
      disabledCode?: UserFeedDisabledCode;
      createdAt: Date;
      computedStatus: UserFeedComputedStatus;
      legacyFeedId?: string;
      ownedByUser: boolean;
      refreshRateSeconds?: number;
    }>(pipeline);

    return results.map((r) => ({
      id: r._id.toString(),
      title: r.title,
      url: r.url,
      inputUrl: r.inputUrl,
      healthStatus: r.healthStatus,
      disabledCode: r.disabledCode,
      createdAt: r.createdAt,
      computedStatus: r.computedStatus,
      legacyFeedId: r.legacyFeedId?.toString(),
      ownedByUser: r.ownedByUser,
      refreshRateSeconds: r.refreshRateSeconds,
    }));
  }

  async getFeedCountByUser(
    userId: string,
    discordUserId: string,
    input: Omit<GetUserFeedsInput, "offset" | "limit" | "sort">
  ): Promise<number> {
    const { search, filters } = input;

    const pipeline = this.generateGetFeedsAggregatePipeline(
      discordUserId,
      userId,
      { search, filters }
    );

    pipeline.push({ $count: "count" });

    const results =
      await this.deps.userFeedRepository.aggregate<{ count: number }>(pipeline);

    return results[0]?.count || 0;
  }

  private generateGetFeedsAggregatePipeline(
    discordUserId: string,
    _userId: string,
    {
      search,
      filters,
    }: {
      search?: string;
      filters?: GetUserFeedsInput["filters"];
    }
  ): Record<string, unknown>[] {
    const pipeline: Record<string, unknown>[] = [
      {
        $match: {
          $or: [
            { "user.discordUserId": discordUserId },
            {
              "shareManageOptions.invites": {
                $elemMatch: {
                  discordUserId,
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
            $eq: ["$user.discordUserId", discordUserId],
          },
          hasBadConnectionCode: {
            $anyElementTrue: {
              $map: {
                input: { $ifNull: ["$connections.discordChannels", []] },
                as: "c",
                in: { $in: ["$$c.disabledCode", BAD_CONNECTION_CODES] },
              },
            },
          },
        },
      },
      {
        $addFields: {
          computedStatus: {
            $cond: {
              if: {
                $or: [
                  { $in: ["$disabledCode", BAD_USER_FEED_CODES] },
                  { $eq: ["$hasBadConnectionCode", true] },
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

    const matchStage: Record<string, unknown> = {};

    if (filters?.ownedByUser !== undefined) {
      matchStage.ownedByUser = filters.ownedByUser;
    }

    if (filters?.computedStatuses?.length) {
      matchStage.computedStatus = { $in: filters.computedStatuses };
    }

    if (search) {
      matchStage.$or = [
        { title: { $regex: search, $options: "i" } },
        { url: { $regex: search, $options: "i" } },
      ];
    }

    if (filters?.disabledCodes?.length) {
      matchStage.disabledCode = {
        $in: filters.disabledCodes.map((c) => (c === null ? null : c)),
      };
    }

    if (filters?.connectionDisabledCodes?.length) {
      const hasNull = filters.connectionDisabledCodes.includes(null);
      const nonNullCodes = filters.connectionDisabledCodes.filter(
        (c) => c !== null
      );

      if (hasNull && nonNullCodes.length > 0) {
        matchStage.$or = [
          ...(matchStage.$or ? (matchStage.$or as unknown[]) : []),
          {
            "connections.discordChannels": {
              $elemMatch: {
                $or: [
                  { disabledCode: { $in: nonNullCodes } },
                  { disabledCode: { $exists: false } },
                ],
              },
            },
          },
        ];
      } else if (hasNull) {
        matchStage["connections.discordChannels.disabledCode"] = {
          $exists: false,
        };
      } else if (nonNullCodes.length > 0) {
        matchStage["connections.discordChannels.disabledCode"] = {
          $in: nonNullCodes,
        };
      }
    }

    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    return pipeline;
  }

  async addFeed(
    opts: { discordUserId: string; userAccessToken: string },
    input: CreateUserFeedInput
  ): Promise<IUserFeed> {
    const { discordUserId } = opts;
    const { url, title } = input;

    const [benefits, user] = await Promise.all([
      this.deps.supportersService.getBenefitsOfDiscordUser(discordUserId),
      this.deps.usersService.getOrCreateUserByDiscordId(discordUserId),
    ]);

    const currentFeedCount =
      await this.calculateCurrentFeedCountOfDiscordUser(discordUserId);

    if (currentFeedCount >= benefits.maxUserFeeds) {
      throw new FeedLimitReachedException("Max feeds reached");
    }

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

    const { finalUrl, enableDateChecks, feedTitle } = await this.checkUrlIsValid(
      url,
      lookupDetails
    );

    const slotOffsetMs = calculateSlotOffsetMs(finalUrl, benefits.refreshRateSeconds);

    const feed = await this.deps.userFeedRepository.create({
      title: title || feedTitle || finalUrl,
      url: finalUrl,
      user: { discordUserId },
    });

    const updates: Record<string, unknown> = {
      $set: {
        refreshRateSeconds: benefits.refreshRateSeconds,
        maxDailyArticles: benefits.maxDailyArticles,
        slotOffsetMs,
      },
    };

    if (url !== finalUrl) {
      (updates.$set as Record<string, unknown>).inputUrl = url;
    }

    if (enableDateChecks) {
      (updates.$set as Record<string, unknown>).dateCheckOptions = {
        oldArticleDateDiffMsThreshold: 1000 * 60 * 60 * 24,
      };
    }

    const updatedFeed = await this.deps.userFeedRepository.updateById(
      feed.id,
      updates
    );

    return updatedFeed || feed;
  }

  async updateFeedById(
    opts: { id: string; discordUserId: string },
    updates: UpdateFeedInput
  ): Promise<IUserFeed | null> {
    const { id, discordUserId } = opts;

    const feed = await this.deps.userFeedRepository.findById(id);
    if (!feed) {
      return null;
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
      const formatOptions = { ...feed.formatOptions, ...updates.formatOptions };
      $set.formatOptions = formatOptions;
    }

    if (updates.dateCheckOptions !== undefined) {
      const dateCheckOptions = {
        ...feed.dateCheckOptions,
        ...updates.dateCheckOptions,
      };
      $set.dateCheckOptions = dateCheckOptions;
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
          feed.disabledCode as UserFeedDisabledCode
        )
      ) {
        $unset.disabledCode = "";
      }
    }

    if (updates.userRefreshRateSeconds !== undefined) {
      if (updates.userRefreshRateSeconds === null) {
        $unset.userRefreshRateSeconds = "";
      } else {
        const benefits =
          await this.deps.supportersService.getBenefitsOfDiscordUser(
            discordUserId
          );

        if (updates.userRefreshRateSeconds < benefits.refreshRateSeconds) {
          throw new RefreshRateNotAllowedException(
            `Refresh rate ${updates.userRefreshRateSeconds} is below minimum ${benefits.refreshRateSeconds}`
          );
        }

        $set.userRefreshRateSeconds = updates.userRefreshRateSeconds;

        const effectiveRefreshRate = updates.userRefreshRateSeconds;
        $set.slotOffsetMs = calculateSlotOffsetMs(
          feed.url,
          effectiveRefreshRate
        );
      }
    }

    if (updates.url !== undefined && updates.url !== feed.url) {
      const user = await this.deps.usersService.getOrCreateUserByDiscordId(
        discordUserId
      );

      const lookupDetails = getFeedRequestLookupDetails({
        feed: { url: updates.url, feedRequestLookupKey: feed.feedRequestLookupKey },
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
        lookupDetails
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
            discordUserId
          )
        ).refreshRateSeconds;

      $set.slotOffsetMs = calculateSlotOffsetMs(finalUrl, effectiveRefreshRate);

      if (enableDateChecks && !feed.dateCheckOptions?.oldArticleDateDiffMsThreshold) {
        $set.dateCheckOptions = {
          ...feed.dateCheckOptions,
          oldArticleDateDiffMsThreshold: 1000 * 60 * 60 * 24,
        };
      }

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
      updateDoc
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
      for (const conn of feed.connections.discordChannels) {
        await this.deps.feedConnectionsDiscordChannelsService.deleteConnection(
          id,
          conn.id
        );
      }
    }

    await this.deps.userFeedRepository.deleteById(id);

    await this.deps.publishMessage(MESSAGE_BROKER_QUEUE_FEED_DELETED, {
      data: { feed: { id } },
    });

    await this.enforceUserFeedLimit(feed.user.discordUserId);

    return feed;
  }

  async bulkDelete(
    feedIds: string[]
  ): Promise<Array<{ id: string; deleted: boolean }>> {
    const feeds = await this.deps.userFeedRepository.findByIds(feedIds);
    const foundIds = new Set(feeds.map((f) => f.id));

    if (this.deps.feedConnectionsDiscordChannelsService) {
      for (const feed of feeds) {
        for (const conn of feed.connections.discordChannels) {
          await this.deps.feedConnectionsDiscordChannelsService.deleteConnection(
            feed.id,
            conn.id
          );
        }
      }
    }

    if (foundIds.size > 0) {
      await this.deps.userFeedRepository.deleteByIds(feeds.map((f) => f.id));

      for (const feed of feeds) {
        await this.deps.publishMessage(MESSAGE_BROKER_QUEUE_FEED_DELETED, {
          data: { feed: { id: feed.id } },
        });
      }
    }

    const userIds = [...new Set(feeds.map((f) => f.user.discordUserId))];
    for (const userId of userIds) {
      await this.enforceUserFeedLimit(userId);
    }

    return feedIds.map((id) => ({
      id,
      deleted: foundIds.has(id),
    }));
  }

  async bulkDisable(
    feedIds: string[]
  ): Promise<Array<{ id: string; disabled: boolean }>> {
    const feeds = await this.deps.userFeedRepository.findByIds(feedIds);
    const eligibleFeeds = feeds.filter(
      (f) =>
        !f.disabledCode ||
        f.disabledCode === UserFeedDisabledCode.ExceededFeedLimit
    );
    const eligibleIds = new Set(eligibleFeeds.map((f) => f.id));

    if (eligibleIds.size > 0) {
      await this.deps.userFeedRepository.updateManyByFilter(
        { _id: { $in: Array.from(eligibleIds) } },
        { $set: { disabledCode: UserFeedDisabledCode.Manual } }
      );
    }

    const userIds = [...new Set(feeds.map((f) => f.user.discordUserId))];
    for (const userId of userIds) {
      await this.enforceUserFeedLimit(userId);
    }

    return feedIds.map((id) => ({
      id,
      disabled: eligibleIds.has(id),
    }));
  }

  async bulkEnable(
    feedIds: string[]
  ): Promise<Array<{ id: string; enabled: boolean }>> {
    const feeds = await this.deps.userFeedRepository.findByIds(feedIds);
    const eligibleFeeds = feeds.filter(
      (f) => f.disabledCode === UserFeedDisabledCode.Manual
    );
    const eligibleIds = new Set(eligibleFeeds.map((f) => f.id));

    if (eligibleIds.size > 0) {
      await this.deps.userFeedRepository.updateManyByFilter(
        { _id: { $in: Array.from(eligibleIds) } },
        { $unset: { disabledCode: 1 } }
      );
    }

    const userIds = [...new Set(feeds.map((f) => f.user.discordUserId))];
    for (const userId of userIds) {
      await this.enforceUserFeedLimit(userId);
    }

    return feedIds.map((id) => ({
      id,
      enabled: eligibleIds.has(id),
    }));
  }

  async validateFeedUrl(
    opts: { discordUserId: string },
    input: { url: string }
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

    const { finalUrl, feedTitle } = await this.checkUrlIsValid(url, lookupDetails);

    return {
      resolvedToUrl: finalUrl !== url ? finalUrl : null,
      feedTitle: feedTitle || undefined,
    };
  }

  async deduplicateFeedUrls(
    discordUserId: string,
    urls: string[]
  ): Promise<string[]> {
    const existingFeeds = await this.deps.userFeedRepository.findByUrls(
      discordUserId,
      urls
    );
    const existingUrls = new Set(existingFeeds.map((f) => f.url));

    return urls.filter((url) => !existingUrls.has(url));
  }

  async calculateCurrentFeedCountOfDiscordUser(
    discordUserId: string
  ): Promise<number> {
    return this.deps.userFeedRepository.countByOwnership(discordUserId);
  }

  private async checkUrlIsValid(
    url: string,
    lookupDetails: FeedRequestLookupDetails | null
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
      const bannedRecord = await this.deps.feedsService.getBannedFeedDetails(
        finalUrl || url,
        ""
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
        `Feed host failed to return a valid, parseable feed`
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
        "Issue encountered with SSL certificate"
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

  private async enforceUserFeedLimit(discordUserId: string): Promise<void> {
    const { maxUserFeeds } =
      await this.deps.supportersService.getBenefitsOfDiscordUser(discordUserId);

    const currentCount =
      await this.calculateCurrentFeedCountOfDiscordUser(discordUserId);

    if (currentCount <= maxUserFeeds) {
      const feedsToEnable = await this.deps.userFeedRepository.aggregate<{
        _id: string;
      }>([
        {
          $match: {
            "user.discordUserId": discordUserId,
            disabledCode: UserFeedDisabledCode.ExceededFeedLimit,
          },
        },
        { $project: { _id: 1 } },
      ]);

      if (feedsToEnable.length > 0) {
        await this.deps.userFeedRepository.updateManyByFilter(
          {
            _id: { $in: feedsToEnable.map((f) => f._id) },
          },
          { $unset: { disabledCode: "" } }
        );
      }
    } else {
      const feedsOverLimit = await this.deps.userFeedRepository.aggregate<{
        _id: string;
      }>([
        {
          $match: {
            "user.discordUserId": discordUserId,
            $or: [
              { disabledCode: { $exists: false } },
              { disabledCode: null },
            ],
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: maxUserFeeds },
        { $project: { _id: 1 } },
      ]);

      if (feedsOverLimit.length > 0) {
        await this.deps.userFeedRepository.updateManyByFilter(
          {
            _id: { $in: feedsOverLimit.map((f) => f._id) },
          },
          { $set: { disabledCode: UserFeedDisabledCode.ExceededFeedLimit } }
        );
      }
    }
  }
}

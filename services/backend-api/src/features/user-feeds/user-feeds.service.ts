/* eslint-disable max-len */
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FeedFetcherService } from "../../services/feed-fetcher/feed-fetcher.service";
import {
  BannedFeedException,
  FeedLimitReachedException,
} from "../feeds/exceptions";
import { FeedsService } from "../feeds/feeds.service";
import { UserFeed, UserFeedModel } from "./entities";
import _ from "lodash";
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
import { PipelineStage, Types } from "mongoose";
import { GetUserFeedsInputDto, GetUserFeedsInputSortKey } from "./dto";
import {
  FeedConnectionDisabledCode,
  FeedConnectionTypeEntityKey,
} from "../feeds/constants";
import { UserFeedComputedStatus } from "./constants/user-feed-computed-status.type";
import {
  UserFeedLimitOverride,
  UserFeedLimitOverrideModel,
} from "../supporters/entities/user-feed-limit-overrides.entity";

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
}

@Injectable()
export class UserFeedsService {
  constructor(
    @InjectModel(UserFeed.name) private readonly userFeedModel: UserFeedModel,
    @InjectModel(UserFeedLimitOverride.name)
    private readonly userFeedLimitOverrideModel: UserFeedLimitOverrideModel,

    private readonly feedsService: FeedsService,
    private readonly feedFetcherService: FeedFetcherService,
    private readonly supportersService: SupportersService,
    private readonly feedHandlerService: FeedHandlerService,
    private readonly feedFetcherApiService: FeedFetcherApiService,
    private readonly amqpConnection: AmqpConnection
  ) {}

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
    const { maxUserFeeds, maxDailyArticles } =
      await this.supportersService.getBenefitsOfDiscordUser(discordUserId);

    const feedCount = await this.userFeedModel
      .where({
        "user.discordUserId": discordUserId,
      })
      .countDocuments();

    if (feedCount >= maxUserFeeds) {
      throw new FeedLimitReachedException("Max feeds reached");
    }

    await this.checkUrlIsValid(url);

    const created = await this.userFeedModel.create({
      title,
      url: url.toLowerCase(),
      user: {
        discordUserId,
      },
    });

    // Primarily used to set up the daily article limit for it to be fetched
    await this.feedHandlerService.initializeFeed(created._id.toHexString(), {
      maxDailyArticles,
    });

    return created;
  }

  async bulkDelete(feedIds: string[], discordUserId: string) {
    const found = await this.userFeedModel
      .find({
        _id: {
          $in: feedIds.map((id) => new Types.ObjectId(id)),
        },
        "user.discordUserId": discordUserId,
      })
      .select("_id legacyFeedId")
      .lean();

    const foundIds = new Set(found.map((doc) => doc._id.toHexString()));
    const legacyFeedIds = new Set(
      found.filter((d) => d.legacyFeedId).map((d) => d._id.toHexString())
    );

    if (found.length > 0) {
      await this.userFeedModel.deleteMany({
        _id: {
          $in: found.map((doc) => doc._id),
        },
      });

      if (legacyFeedIds.size > 0) {
        await this.userFeedLimitOverrideModel.updateOne({
          _id: discordUserId,
          $inc: {
            additionalUserFeeds: -legacyFeedIds.size,
          },
        });
      }
    }

    return feedIds.map((id) => ({
      id,
      deleted: foundIds.has(id),
      isLegacy: legacyFeedIds.has(id),
    }));
  }

  async bulkDisable(feedIds: string[], discordUserId: string) {
    const found = await this.userFeedModel

      .find({
        _id: {
          $in: feedIds.map((id) => new Types.ObjectId(id)),
        },
        "user.discordUserId": discordUserId,
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

  async bulkEnable(feedIds: string[], discordUserId: string) {
    const found = await this.userFeedModel

      .find({
        _id: {
          $in: feedIds.map((id) => new Types.ObjectId(id)),
        },
        "user.discordUserId": discordUserId,
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

  async updateFeedById(id: string, updates: UpdateFeedInput) {
    const query = this.userFeedModel.findByIdAndUpdate(
      id,
      {
        $unset: {
          ...(updates.disabledCode === null && {
            disabledCode: "",
          }),
        },
      },
      {
        new: true,
      }
    );

    if (updates.title) {
      query.set("title", updates.title);
    }

    if (updates.url) {
      await this.checkUrlIsValid(updates.url);
      query.set("url", updates.url);
    }

    if (updates.disabledCode) {
      query.set("disabledCode", updates.disabledCode);
    }

    if (updates.passingComparisons) {
      query.set("passingComparisons", updates.passingComparisons);
    }

    if (updates.blockingComparisons) {
      query.set("blockingComparisons", updates.blockingComparisons);
    }

    if (updates.formatOptions) {
      query.set("formatOptions", updates.formatOptions);
    }

    if (updates.dateCheckOptions) {
      query.set("dateCheckOptions", updates.dateCheckOptions);
    }

    return query.lean();
  }

  async deleteFeedById(id: string) {
    const found = await this.userFeedModel.findByIdAndDelete(id);

    if (found?.legacyFeedId) {
      const discordUserId = found.user.discordUserId;
      await this.userFeedLimitOverrideModel.updateOne(
        {
          _id: discordUserId,
        },
        {
          $inc: {
            additionalUserFeeds: -1,
          },
        }
      );
    }

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

  async getFeedDailyLimit(feedId: string) {
    const {
      results: { limits },
    } = await this.feedHandlerService.getRateLimits(feedId);

    return limits.find((limit) => limit.windowSeconds === 86400);
  }

  async getFeedArticles({
    limit,
    url,
    random,
    filters,
    selectProperties,
    skip,
    formatter,
  }: GetFeedArticlesInput): Promise<GetFeedArticlesOutput> {
    return this.feedHandlerService.getArticles({
      url,
      limit,
      random,
      filters,
      skip: skip || 0,
      selectProperties,
      formatter,
    });
  }

  async getFeedArticleProperties({
    url,
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
        },
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
          "user.discordUserId": userId,
        },
      },
      {
        $addFields: {
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

    if (filters?.computedStatuses?.length) {
      pipeline.push({
        $match: {
          computedStatus: {
            $in: filters.computedStatuses,
          },
        },
      });
    }

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            {
              title: new RegExp(_.escapeRegExp(search), "i"),
            },
            {
              url: new RegExp(_.escapeRegExp(search), "i"),
            },
          ],
        },
      });
    }

    if (filters?.disabledCodes) {
      pipeline.push({
        $match: {
          disabledCode: {
            $in: filters.disabledCodes.map((c) => (c === "" ? null : c)),
          },
        },
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
    supporterLimits: Array<{ discordUserId: string; maxUserFeeds: number }>
  ) {
    const supporterDiscordUserIds = supporterLimits.map(
      ({ discordUserId }) => discordUserId
    );
    const defaultMaxUserFeeds = this.supportersService.defaultMaxUserFeeds;

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

    // if (usersToEnable.length > 0) {
    //   logger.info(
    //     `Enabling feeds of ${usersToEnable.length} users` +
    //       ` (using default limit: ${defaultMaxUserFeeds})`,
    //     {
    //       usersToEnable,
    //     }
    //   );
    // }

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
    await Promise.all(
      supporterLimits.map(async ({ discordUserId, maxUserFeeds }) => {
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

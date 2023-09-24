import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { SupportersService } from "../supporters/supporters.service";
import { Aggregate, Cursor, FilterQuery, PipelineStage } from "mongoose";
import logger from "../../utils/logger";
import {
  UserFeedDisabledCode,
  UserFeedHealthStatus,
} from "../user-feeds/types";
import {
  UserFeed,
  UserFeedDocument,
  UserFeedModel,
} from "../user-feeds/entities";
import { AmqpConnection, RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { DiscordMediumEvent } from "../../common";
import {
  castDiscordContentForMedium,
  castDiscordEmbedsForMedium,
} from "../../common/utils";
import { MessageBrokerQueue } from "../../common/constants/message-broker-queue.constants";
import { ArticleRejectCode, FeedRejectCode } from "./constants";
import {
  getConnectionDisableCodeByArticleRejectCode,
  getUserFeedDisableCodeByFeedRejectCode,
} from "./utils";
import { UserFeedsService } from "../user-feeds/user-feeds.service";
import { FeedFetcherFetchStatus } from "../../services/feed-fetcher/types";
import { NotificationsService } from "../notifications/notifications.service";
import { UsersService } from "../users/users.service";
import {
  DiscordChannelConnection,
  DiscordWebhookConnection,
} from "../feeds/entities/feed-connections";

interface PublishFeedDeliveryArticlesData {
  timestamp: number;
  debug?: boolean;
  data: {
    feed: {
      id: string;
      url: string;
      passingComparisons: string[];
      blockingComparisons: string[];
      formatOptions: {
        dateFormat: string | undefined;
        dateTimezone: string | undefined;
      };
      dateChecks?: {
        oldArticleDateDiffMsThreshold?: number;
      };
    };
    articleDayLimit: number;
    mediums: Array<DiscordMediumEvent>;
  };
}

@Injectable()
export class ScheduleHandlerService {
  defaultRefreshRateSeconds: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly supportersService: SupportersService,
    @InjectModel(UserFeed.name) private readonly userFeedModel: UserFeedModel,
    private readonly amqpConnection: AmqpConnection,
    private readonly userFeedsService: UserFeedsService,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService
  ) {
    this.defaultRefreshRateSeconds =
      (this.configService.get<number>(
        "BACKEND_API_DEFAULT_REFRESH_RATE_MINUTES"
      ) as number) * 60;
  }

  @RabbitSubscribe({
    exchange: "",
    queue: MessageBrokerQueue.UrlFetchCompleted,
    createQueueIfNotExists: true,
  })
  async handleUrlFetchCompletedEvent({
    data: { url, rateSeconds },
  }: {
    data: { url: string; rateSeconds: number };
  }) {
    const feedCursor: Cursor<UserFeedDocument> =
      this.getFeedsQueryMatchingRefreshRate({
        url,
        refreshRateSeconds: rateSeconds,
      }).cursor();

    for await (const feed of feedCursor) {
      try {
        const cons = Object.values(feed.connections).flat() as Array<
          DiscordChannelConnection | DiscordWebhookConnection
        >;

        const hasCustomPlaceholders = cons.find(
          (c) => !c.customPlaceholders?.length
        );

        let allowCustomPlaceholders = false;

        if (hasCustomPlaceholders) {
          const benefits =
            await this.supportersService.getBenefitsOfDiscordUser(
              feed.user.discordUserId
            );

          allowCustomPlaceholders = benefits.allowCustomPlaceholders;
        }

        await this.emitDeliverFeedArticlesEvent({
          userFeed: feed,
          maxDailyArticles: feed.maxDailyArticles as number,
          parseCustomPlaceholders: allowCustomPlaceholders,
        });
      } catch (err) {
        logger.error(
          `Failed to emit deliver feed articles event: ${
            (err as Error).message
          }`,
          {
            stack: (err as Error).stack,
          }
        );
      }
    }
  }

  @RabbitSubscribe({
    exchange: "",
    queue: MessageBrokerQueue.UrlRejectedDisableFeeds,
    createQueueIfNotExists: true,
  })
  async handleUrlRejectedDisableFeedsEvent({
    data: { url, status },
  }: {
    data: {
      url: string;
      status: Extract<
        FeedFetcherFetchStatus,
        FeedFetcherFetchStatus.RefusedLargeFeed
      >;
    };
  }) {
    logger.debug(`handling url rejected disable feeds event for url ${url}`);

    if (status === FeedFetcherFetchStatus.RefusedLargeFeed) {
      await this.userFeedModel
        .updateMany(
          {
            url,
            disabledCode: {
              $exists: false,
            },
          },
          {
            $set: {
              disabledCode: UserFeedDisabledCode.FeedTooLarge,
            },
          }
        )
        .lean();
    }
  }

  @RabbitSubscribe({
    exchange: "",
    queue: MessageBrokerQueue.UrlFailedDisableFeeds,
  })
  async handleUrlRequestFailureEvent({
    data: { url },
  }: {
    data: { url: string };
  }) {
    logger.debug(`handling url request failure event for url ${url}`);

    const relevantFeeds = await this.userFeedModel
      .find({
        url,
        disabledCode: {
          $exists: false,
        },
      })
      .select("_id")
      .lean();

    const relevantFeedIds = relevantFeeds.map((f) => f._id);

    await this.userFeedModel
      .updateMany(
        {
          _id: {
            $in: relevantFeedIds,
          },
        },
        {
          $set: {
            disabledCode: UserFeedDisabledCode.FailedRequests,
            healthStatus: UserFeedHealthStatus.Failed,
          },
        }
      )
      .lean();

    try {
      await this.notificationsService.sendDisabledFeedsAlert(relevantFeedIds, {
        disabledCode: UserFeedDisabledCode.FailedRequests,
      });
    } catch (err) {
      logger.error(`Failed to send disabled feeds alert`, {
        stack: (err as Error).stack,
      });
    }
  }

  @RabbitSubscribe({
    exchange: "",
    queue: MessageBrokerQueue.FeedRejectedDisableFeed,
  })
  async handleFeedRejectedDisableFeed({
    data: {
      feed: { id: feedId },
      rejectedCode,
    },
  }: {
    data: {
      rejectedCode: FeedRejectCode;
      feed: {
        id: string;
      };
    };
  }) {
    const foundFeed = await this.userFeedModel.findById(feedId).lean();

    if (!foundFeed) {
      logger.warn(
        `No feed with ID ${feedId} was found when attempting to` +
          ` handle message from ${MessageBrokerQueue.FeedRejectedDisableFeed}`
      );

      return;
    }

    const disabledCode = getUserFeedDisableCodeByFeedRejectCode(rejectedCode);

    await this.userFeedModel.updateOne(
      {
        _id: foundFeed._id,
        disabledCode: {
          $exists: false,
        },
      },
      {
        $set: {
          disabledCode,
        },
      }
    );

    try {
      logger.debug(
        `Preparing to send disabled feeds alert to ${foundFeed._id} for reason ${disabledCode}`
      );
      await this.notificationsService.sendDisabledFeedsAlert([foundFeed._id], {
        disabledCode,
      });
    } catch (err) {
      logger.error(`Failed to send disabled feeds alert`, {
        stack: (err as Error).stack,
      });
    }
  }

  @RabbitSubscribe({
    exchange: "",
    queue: MessageBrokerQueue.FeedRejectedArticleDisableConnection,
  })
  async handleRejectedArticleDisableConnection({
    data: {
      rejectedCode,
      medium: { id: mediumId },
      feed: { id: feedId },
    },
  }: {
    data: {
      rejectedCode: ArticleRejectCode;
      medium: {
        id: string;
      };
      feed: {
        id: string;
      };
    };
  }) {
    const foundFeed = await this.userFeedModel.findById(feedId).lean();

    if (!foundFeed) {
      logger.warn(
        `No feed with ID ${feedId} was found when attempting to` +
          ` handle message from ${MessageBrokerQueue.FeedRejectedArticleDisableConnection}`
      );

      return;
    }

    const connectionEntries = Object.entries(foundFeed.connections) as Array<
      [
        keyof UserFeed["connections"],
        UserFeed["connections"][keyof UserFeed["connections"]]
      ]
    >;

    const disableCode =
      getConnectionDisableCodeByArticleRejectCode(rejectedCode);

    for (const [connectionKey, connections] of connectionEntries) {
      for (let conIdx = 0; conIdx < connections.length; ++conIdx) {
        const connection = connections[conIdx];

        if (connection.id.toHexString() !== mediumId) {
          continue;
        }

        await this.userFeedModel.updateOne(
          {
            _id: feedId,
            [`connections.${connectionKey}.${conIdx}.disabledCode`]: {
              $exists: false,
            },
          },
          {
            $set: {
              [`connections.${connectionKey}.${conIdx}.disabledCode`]:
                disableCode,
            },
          }
        );

        try {
          logger.debug(
            `Sending disabled feed connection alert email for ${foundFeed._id}, ${connection.id}`
          );
          await this.notificationsService.sendDisabledFeedConnectionAlert(
            foundFeed,
            connection,
            {
              disabledCode: disableCode,
            }
          );
        } catch (err) {
          logger.error(
            "Failed to send disabled feed connection alert email in notifications service",
            {
              stack: (err as Error).stack,
            }
          );
        }

        break;
      }
    }
  }

  async emitUrlRequestEvent(data: { url: string; rateSeconds: number }) {
    this.amqpConnection.publish<{ data: { url: string; rateSeconds: number } }>(
      "",
      MessageBrokerQueue.UrlFetch,
      { data },
      {
        expiration: data.rateSeconds * 1000,
      }
    );

    logger.debug("successfully emitted url request event");
  }

  async emitUrlRequestBatchEvent(data: {
    rateSeconds: number;
    data: Array<{ url: string }>;
  }) {
    this.amqpConnection.publish<{
      rateSeconds: number;
      timestamp: number;
      data: Array<{ url: string; saveToObjectStorage?: boolean }>;
    }>(
      "",
      MessageBrokerQueue.UrlFetchBatch,
      { ...data, timestamp: Date.now() },
      {
        expiration: data.rateSeconds * 1000,
      }
    );

    logger.debug("successfully emitted url request event");
  }

  emitDeliverFeedArticlesEvent({
    userFeed,
    maxDailyArticles,
    parseCustomPlaceholders,
  }: {
    userFeed: UserFeed;
    maxDailyArticles: number;
    parseCustomPlaceholders: boolean;
  }) {
    const discordChannelMediums = userFeed.connections.discordChannels
      .filter((c) => !c.disabledCode)
      .map<DiscordMediumEvent>((con) => ({
        id: con.id.toHexString(),
        key: "discord",
        filters: con.filters?.expression
          ? { expression: con.filters.expression }
          : null,
        rateLimits: con.rateLimits,
        details: {
          guildId: con.details.channel.guildId,
          channel: {
            id: con.details.channel.id,
            type: con.details.channel.type,
            guildId: con.details.channel.guildId,
          },
          content: castDiscordContentForMedium(con.details.content),
          embeds: castDiscordEmbedsForMedium(con.details.embeds),
          forumThreadTitle: con.details.forumThreadTitle,
          forumThreadTags: con.details.forumThreadTags,
          mentions: con.mentions,
          customPlaceholders: parseCustomPlaceholders
            ? con.customPlaceholders
            : [],
          formatter: {
            formatTables: con.details.formatter?.formatTables,
            stripImages: con.details.formatter?.stripImages,
            disableImageLinkPreviews:
              con.details.formatter?.disableImageLinkPreviews,
          },
          splitOptions: con.splitOptions?.isEnabled
            ? con.splitOptions
            : undefined,
          placeholderLimits: con.details.placeholderLimits,
          enablePlaceholderFallback: con.details.enablePlaceholderFallback,
        },
      }));

    const discordWebhookMediums = userFeed.connections.discordWebhooks
      .filter((c) => !c.disabledCode)
      .map<DiscordMediumEvent>((con) => ({
        id: con.id.toHexString(),
        key: "discord",
        filters: con.filters?.expression
          ? { expression: con.filters.expression }
          : null,
        rateLimits: con.rateLimits,
        details: {
          guildId: con.details.webhook.guildId,
          webhook: {
            id: con.details.webhook.id,
            token: con.details.webhook.token,
            name: con.details.webhook.name,
            iconUrl: con.details.webhook.iconUrl,
            type: con.details.webhook.type,
          },
          content: castDiscordContentForMedium(con.details.content),
          embeds: castDiscordEmbedsForMedium(con.details.embeds),
          forumThreadTitle: con.details.forumThreadTitle,
          formatter: {
            formatTables: con.details.formatter?.formatTables,
            stripImages: con.details.formatter?.stripImages,
            disableImageLinkPreviews:
              con.details.formatter?.disableImageLinkPreviews,
          },
          splitOptions: con.splitOptions?.isEnabled
            ? con.splitOptions
            : undefined,
          mentions: con.mentions,
          customPlaceholders: parseCustomPlaceholders
            ? con.customPlaceholders
            : [],
          placeholderLimits: con.details.placeholderLimits,
          enablePlaceholderFallback: con.details.enablePlaceholderFallback,
        },
      }));

    const allMediums = discordChannelMediums.concat(discordWebhookMediums);

    this.amqpConnection.publish<PublishFeedDeliveryArticlesData>(
      "",
      MessageBrokerQueue.FeedDeliverArticles,
      {
        debug: userFeed.debug,
        timestamp: Date.now(),
        data: {
          articleDayLimit: maxDailyArticles,
          feed: {
            id: userFeed._id.toHexString(),
            url: userFeed.url,
            passingComparisons: userFeed.passingComparisons || [],
            blockingComparisons: userFeed.blockingComparisons || [],
            formatOptions: {
              dateFormat: userFeed.formatOptions?.dateFormat,
              dateTimezone: userFeed.formatOptions?.dateTimezone,
            },
            dateChecks: userFeed.dateCheckOptions,
          },
          mediums: allMediums,
        },
      },
      {
        expiration: 1000 * 60 * 60, // 1 hour
      }
    );

    logger.debug("successfully emitted deliver feed articles event");
  }

  async handleRefreshRate(
    refreshRateSeconds: number,
    {
      urlsHandler,
    }: {
      urlsHandler: (data: Array<{ url: string }>) => Promise<void>;
    }
  ) {
    const allBenefits =
      await this.supportersService.getBenefitsOfAllDiscordUsers();

    await this.syncRefreshRates(allBenefits);
    await this.syncMaxDailyArticles(allBenefits);

    const feedsToDebug = await this.userFeedModel
      .find({
        debug: true,
      })
      .select("_id url")
      .lean();

    const urlsToDebug = new Set(feedsToDebug.map((f) => f.url));

    const urlsCursor =
      this.getUrlsQueryMatchingRefreshRate(refreshRateSeconds).cursor();

    let urlBatch: { url: string; saveToObjectStorage?: boolean }[] = [];

    for await (const { _id: url } of urlsCursor) {
      if (!url) {
        // Just in case
        continue;
      }

      urlBatch.push({ url, saveToObjectStorage: urlsToDebug.has(url) });

      if (urlBatch.length === 25) {
        await urlsHandler(urlBatch);
        urlBatch = [];
      }
    }

    if (urlBatch.length > 0) {
      await urlsHandler(urlBatch);
    }
  }

  getUrlsQueryMatchingRefreshRate(refreshRateSeconds: number) {
    const pipeline = this.getCommonFeedAggregateStages({ refreshRateSeconds });

    pipeline.push({
      $group: {
        _id: "$url",
      },
    });

    return this.userFeedModel.aggregate(pipeline);
  }

  getFeedsQueryMatchingRefreshRate(data: {
    refreshRateSeconds: number;
    url: string;
  }): Aggregate<UserFeedDocument[]> {
    return this.userFeedModel.aggregate(
      this.getCommonFeedAggregateStages(data)
    );
  }

  async getValidDiscordUserSupporters() {
    const allBenefits =
      await this.supportersService.getBenefitsOfAllDiscordUsers();

    return allBenefits.filter(({ isSupporter }) => isSupporter);
  }

  private getCommonFeedAggregateStages({
    refreshRateSeconds,
    url,
  }: {
    refreshRateSeconds: number;
    url?: string;
  }) {
    const query: FilterQuery<UserFeedDocument> = {
      ...(url ? { url } : {}),
      disabledCode: {
        $exists: false,
      },
      $or: [
        {
          "connections.discordChannels.0": {
            $exists: true,
          },
          "connections.discordChannels": {
            $elemMatch: {
              disabledCode: {
                $exists: false,
              },
            },
          },
        },
        {
          "connections.discordWebhooks.0": {
            $exists: true,
          },
          "connections.discordWebhooks": {
            $elemMatch: {
              disabledCode: {
                $exists: false,
              },
            },
          },
        },
      ],
    };

    const pipelineStages: PipelineStage[] = [
      {
        $match: query,
      },
      {
        $addFields: {
          useRefreshRate: {
            $ifNull: ["$userRefreshRateSeconds", "$refreshRateSeconds"],
          },
        },
      },
      {
        $match: {
          useRefreshRate: refreshRateSeconds,
        },
      },
    ];

    return pipelineStages;
  }

  async enforceUserFeedLimits() {
    const benefits =
      await this.supportersService.getBenefitsOfAllDiscordUsers();

    await this.userFeedsService.enforceUserFeedLimits(
      benefits.map(({ discordUserId, maxUserFeeds }) => ({
        discordUserId,
        maxUserFeeds,
      }))
    );
  }

  async syncRefreshRates(
    benefits: Awaited<
      ReturnType<typeof this.supportersService.getBenefitsOfAllDiscordUsers>
    >
  ) {
    const validSupporters = benefits.filter(({ isSupporter }) => isSupporter);

    const supportersByRefreshRates = new Map<number, string[]>();

    for (const s of validSupporters) {
      const { refreshRateSeconds } = s;

      const currentDiscordUserIds =
        supportersByRefreshRates.get(refreshRateSeconds);

      if (!currentDiscordUserIds) {
        supportersByRefreshRates.set(refreshRateSeconds, [s.discordUserId]);
      } else {
        currentDiscordUserIds.push(s.discordUserId);
      }
    }

    const refreshRates = Array.from(supportersByRefreshRates.entries());

    const specialDiscordUserIds: string[] = [];

    await Promise.all(
      refreshRates.map(async ([refreshRateSeconds, discordUserIds]) => {
        await this.userFeedModel.updateMany(
          {
            "user.discordUserId": {
              $in: discordUserIds,
            },
            refreshRateSeconds: {
              $ne: refreshRateSeconds,
            },
          },
          {
            $set: {
              refreshRateSeconds,
            },
          }
        );

        specialDiscordUserIds.push(...discordUserIds);
      })
    );

    await this.userFeedModel.updateMany(
      {
        "user.discordUserId": {
          $nin: specialDiscordUserIds,
        },
        refreshRateSeconds: {
          $ne: this.defaultRefreshRateSeconds,
        },
      },
      {
        $set: {
          refreshRateSeconds: this.defaultRefreshRateSeconds,
        },
      }
    );
  }

  async syncMaxDailyArticles(
    benefits: Awaited<
      ReturnType<typeof this.supportersService.getBenefitsOfAllDiscordUsers>
    >
  ) {
    const validSupporters = benefits.filter(({ isSupporter }) => isSupporter);

    const supportersByMaxDailyArticles = new Map<number, string[]>();

    for (const s of validSupporters) {
      const { maxDailyArticles } = s;

      const currentDiscordUserIdsByMaxDailyArticles =
        supportersByMaxDailyArticles.get(maxDailyArticles);

      if (!currentDiscordUserIdsByMaxDailyArticles) {
        supportersByMaxDailyArticles.set(maxDailyArticles, [s.discordUserId]);
      } else {
        currentDiscordUserIdsByMaxDailyArticles.push(s.discordUserId);
      }
    }

    const maxDailyArticles = Array.from(supportersByMaxDailyArticles.entries());

    const specialDiscordUserIds: string[] = [];

    await Promise.all(
      maxDailyArticles.map(async ([maxDailyArticles, discordUserIds]) => {
        await this.userFeedModel.updateMany(
          {
            "user.discordUserId": {
              $in: discordUserIds,
            },
            maxDailyArticles: {
              $ne: maxDailyArticles,
            },
          },
          {
            $set: {
              maxDailyArticles,
            },
          }
        );

        specialDiscordUserIds.push(...discordUserIds);
      })
    );

    await this.userFeedModel.updateMany(
      {
        "user.discordUserId": {
          $nin: specialDiscordUserIds,
        },
        maxDailyArticles: {
          $ne: this.supportersService.maxDailyArticlesDefault,
        },
      },
      {
        $set: {
          maxDailyArticles: this.supportersService.maxDailyArticlesDefault,
        },
      }
    );
  }
}

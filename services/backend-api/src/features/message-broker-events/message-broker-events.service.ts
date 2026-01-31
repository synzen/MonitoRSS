/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { AmqpConnection, RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Aggregate, Cursor } from "mongoose";
import { DiscordMediumEvent } from "../../common";
import { MessageBrokerQueue } from "../../common/constants/message-broker-queue.constants";
import {
  castDiscordContentForMedium,
  castDiscordEmbedsForMedium,
  getCommonFeedAggregateStages,
} from "../../common/utils";
import { castDiscordComponentRowsForMedium } from "../../common/utils/cast-discord-component-rows-from-connection";
import { FeedFetcherFetchStatus } from "../../services/feed-fetcher/types";
import logger from "../../utils/logger";
import { DiscordChannelConnection } from "../feeds/entities/feed-connections";
import { NotificationsService } from "../notifications/notifications.service";
import {
  ArticleRejectCode,
  FeedRejectCode,
} from "../schedule-handler/constants";
import {
  getConnectionDisableCodeByArticleRejectCode,
  getUserFeedDisableCodeByFeedRejectCode,
} from "../schedule-handler/utils";
import { SupportersService } from "../supporters/supporters.service";
import {
  UserFeed,
  UserFeedDocument,
  UserFeedModel,
} from "../user-feeds/entities";
import {
  UserFeedConnection,
  UserFeedDisabledCode,
  UserFeedHealthStatus,
} from "../user-feeds/types";
import { User, UserDocument } from "../users/entities/user.entity";
import getFeedRequestLookupDetails from "../../utils/get-feed-request-lookup-details";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class MessageBrokerEventsService {
  constructor(
    @InjectModel(UserFeed.name) private readonly userFeedModel: UserFeedModel,
    private readonly amqpConnection: AmqpConnection,
    private readonly supportersService: SupportersService,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService
  ) {}

  @RabbitSubscribe({
    exchange: "",
    queue: MessageBrokerQueue.SyncSupporterDiscordRoles,
    createQueueIfNotExists: true,
  })
  async handleSyncSupporterDiscordRoles({
    data: { userId },
  }: {
    data: { userId: string };
  }) {
    logger.info(`User ${userId} has joined support server`);
    await this.supportersService.syncDiscordSupporterRoles(userId);
  }

  @RabbitSubscribe({
    exchange: "",
    queue: MessageBrokerQueue.UrlFailing,
    createQueueIfNotExists: true,
  })
  async handleUrlFailing({
    data: { lookupKey, url },
  }: {
    data: { lookupKey?: string; url: string };
  }) {
    await this.userFeedModel.updateMany(
      {
        ...(lookupKey ? { feedRequestLookupKey: lookupKey } : { url }),
        healthStatus: {
          $ne: UserFeedHealthStatus.Failing,
        },
      },
      {
        $set: {
          healthStatus: UserFeedHealthStatus.Failing,
        },
      }
    );
  }

  @RabbitSubscribe({
    exchange: "",
    queue: MessageBrokerQueue.UrlFetchCompleted,
    createQueueIfNotExists: true,
  })
  async handleUrlFetchCompletedEvent({
    data: { url, lookupKey, rateSeconds, debug },
  }: {
    data: {
      url: string;
      lookupKey?: string;
      rateSeconds: number;
      debug?: boolean;
    };
  }) {
    if (debug) {
      logger.info(`DEBUG ${lookupKey || url}: In url fetch completed`, {
        url,
        lookupKey,
        rateSeconds,
      });
    }

    logger.debug("Got url fetched event", { lookupKey, url, rateSeconds });
    const healthStatusUpdateCount = await this.userFeedModel.countDocuments({
      ...(lookupKey ? { feedRequestLookupKey: lookupKey } : { url }),
      healthStatus: {
        $ne: UserFeedHealthStatus.Ok,
      },
    });

    if (healthStatusUpdateCount > 0) {
      await this.userFeedModel.updateMany(
        {
          ...(lookupKey ? { feedRequestLookupKey: lookupKey } : { url }),
          healthStatus: {
            $ne: UserFeedHealthStatus.Ok,
          },
        },
        {
          $set: {
            healthStatus: UserFeedHealthStatus.Ok,
          },
        }
      );
    }

    let feedCursor: Cursor<UserFeedDocument & { users: UserDocument[] }>;

    if (lookupKey) {
      feedCursor = this.getFeedsQueryWithLookupKeysMatchingRefreshRate({
        feedRequestLookupKey: lookupKey,
        refreshRateSeconds: rateSeconds,
        debug,
      }).cursor();
    } else {
      feedCursor = this.getFeedsQueryMatchingRefreshRate({
        url,
        refreshRateSeconds: rateSeconds,
        debug,
      }).cursor();
    }

    for await (const feed of feedCursor) {
      try {
        if (feed.debug) {
          logger.info(`DEBUG ${feed._id}: Handling url fetch completed event`, {
            feed,
          });
        }

        const cons = Object.values(
          feed.connections
        ).flat() as Array<DiscordChannelConnection>;

        const hasCustomPlaceholders = cons.find(
          (c) => !c.customPlaceholders?.length
        );
        const hasExternalProperties = !!feed.externalProperties?.length;
        const hasPremiumFeatures =
          hasCustomPlaceholders || hasExternalProperties;

        let allowCustomPlaceholders = false;
        let allowExternalProperties = false;

        if (hasPremiumFeatures) {
          const benefits =
            await this.supportersService.getBenefitsOfDiscordUser(
              feed.user.discordUserId
            );

          allowCustomPlaceholders = benefits.allowCustomPlaceholders;
          allowExternalProperties = benefits.allowExternalProperties;
        }

        await this.emitDeliverFeedArticlesEvent({
          userFeed: feed,
          maxDailyArticles: feed.maxDailyArticles as number,
          parseCustomPlaceholders: allowCustomPlaceholders,
          parseExternalProperties: allowExternalProperties,
          user: feed.users[0],
        });

        // await this.userFeedModel.updateOne(
        //   {
        //     _id: feed._id,
        //   },
        //   {
        //     $set: {
        //       lastRefreshedAt: new Date(),
        //     },
        //   },
        //   {
        //     writeConcern: {
        //       w: 0,
        //       journal: false,
        //     },
        //   }
        // );
      } catch (err) {
        logger.error(
          `Failed to emit deliver feed articles event for feed ${feed._id}: ${
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
    data: { url, status, lookupKey },
  }: {
    data: {
      url: string;
      lookupKey?: string;
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
            ...(lookupKey ? { feedRequestLookupKey: lookupKey } : { url }),
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
    data: { url, lookupKey },
  }: {
    data: { url: string; lookupKey?: string };
  }) {
    logger.debug(`handling url request failure event for url ${url}`);

    const relevantFeeds = await this.userFeedModel
      .find({
        ...(lookupKey ? { feedRequestLookupKey: lookupKey } : { url }),
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
      logger.info(
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
      articleId,
      rejectedMessage,
      medium: { id: mediumId },
      feed: { id: feedId },
    },
  }: {
    data: {
      rejectedCode: ArticleRejectCode;
      rejectedMessage?: string;
      articleId?: string;
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
      [keyof UserFeed["connections"], UserFeedConnection[]]
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

              [`connections.${connectionKey}.${conIdx}.disabledDetail`]:
                rejectedMessage,
            },
          }
        );

        try {
          logger.info(
            `Sending disabled feed connection alert notification for ${foundFeed._id}, ${connection.id}`
          );
          await this.notificationsService.sendDisabledFeedConnectionAlert(
            foundFeed,
            connection,
            {
              disabledCode: disableCode,
              articleId,
              rejectedMessage,
            }
          );
        } catch (err) {
          logger.error(
            "Failed to send disabled feed connection alert in notifications service",
            {
              stack: (err as Error).stack,
            }
          );
        }

        break;
      }
    }
  }

  emitDeliverFeedArticlesEvent({
    userFeed,
    maxDailyArticles,
    parseCustomPlaceholders,
    parseExternalProperties,
    user,
  }: {
    userFeed: UserFeed;
    maxDailyArticles: number;
    parseCustomPlaceholders: boolean;
    parseExternalProperties?: boolean;
    user?: User;
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
          channelNewThreadTitle: con.details.channelNewThreadTitle,
          channelNewThreadExcludesPreview:
            con.details.channelNewThreadExcludesPreview,
          guildId: con.details.channel?.guildId || con.details.webhook!.guildId,
          channel: con.details.channel
            ? {
                id: con.details.channel.id,
                type: con.details.channel.type,
                guildId: con.details.channel.guildId,
              }
            : undefined,
          webhook: con.details.webhook
            ? {
                id: con.details.webhook.id,
                token: con.details.webhook.token,
                name: con.details.webhook.name,
                iconUrl: con.details.webhook.iconUrl,
                type: con.details.webhook.type,
                threadId: con.details.webhook.threadId,
              }
            : undefined,
          content: castDiscordContentForMedium(con.details.content),
          embeds: castDiscordEmbedsForMedium(con.details.embeds),
          components: castDiscordComponentRowsForMedium(
            con.details.componentRows
          ),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          componentsV2: con.details.componentsV2 as any,
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
            ignoreNewLines: con.details.formatter?.ignoreNewLines,
            connectionCreatedAt: con.createdAt?.toISOString(),
          },
          splitOptions: con.splitOptions?.isEnabled
            ? con.splitOptions
            : undefined,
          placeholderLimits: con.details.placeholderLimits,
          enablePlaceholderFallback: con.details.enablePlaceholderFallback,
        },
      }));

    const allMediums = discordChannelMediums;
    const requestLookupDetails = getFeedRequestLookupDetails({
      feed: userFeed,
      user: {
        externalCredentials: user?.externalCredentials,
      },
      decryptionKey: this.configService.get("BACKEND_API_ENCRYPTION_KEY_HEX"),
    });
    const publishData = {
      articleDayLimit: maxDailyArticles,
      feed: {
        id: userFeed._id.toHexString(),
        requestLookupDetails: requestLookupDetails
          ? {
              key: requestLookupDetails.key,
              url: requestLookupDetails.url,
              headers: requestLookupDetails.headers,
            }
          : undefined,
        url: userFeed.url,
        passingComparisons: userFeed.passingComparisons || [],
        blockingComparisons: userFeed.blockingComparisons || [],
        formatOptions: {
          dateFormat:
            userFeed.formatOptions?.dateFormat || user?.preferences?.dateFormat,
          dateTimezone:
            userFeed.formatOptions?.dateTimezone ||
            user?.preferences?.dateTimezone,
          dateLocale:
            userFeed.formatOptions?.dateLocale || user?.preferences?.dateLocale,
        },
        externalProperties: parseExternalProperties
          ? userFeed.externalProperties
          : undefined,
        dateChecks: userFeed.dateCheckOptions,
      },
      mediums: allMediums,
    };

    if (userFeed.debug) {
      logger.info(`DEBUG ${userFeed._id}: Emitting event`, {
        data: publishData,
      });
    }

    this.amqpConnection.publish(
      "",
      MessageBrokerQueue.FeedDeliverArticles,
      {
        debug: userFeed.debug,
        timestamp: Date.now(),
        data: publishData,
        source: "backend-api::message-broker-events",
      },
      {
        expiration: 1000 * 60 * 10, // 10 minutes
      }
    );

    logger.debug("successfully emitted deliver feed articles event");
  }

  getFeedsQueryMatchingRefreshRate(data: {
    refreshRateSeconds: number;
    url: string;
    debug?: boolean;
  }): Aggregate<(UserFeedDocument & { users: UserDocument[] })[]> {
    const pipeline = getCommonFeedAggregateStages(data);

    if (data.debug) {
      logger.info(
        `DEBUG ${data.url}: Looking for feeds with MongoDB aggregate pipeline`,
        { pipeline, ...data }
      );
    }

    return this.userFeedModel.aggregate(pipeline);
  }

  getFeedsQueryWithLookupKeysMatchingRefreshRate(data: {
    refreshRateSeconds: number;
    feedRequestLookupKey: string;
    debug?: boolean;
  }): Aggregate<(UserFeedDocument & { users: UserDocument[] })[]> {
    const pipeline = getCommonFeedAggregateStages(data);

    if (data.debug) {
      logger.info(
        `DEBUG ${data.feedRequestLookupKey}: Looking for feeds via lookup key with MongoDB aggregate pipeline`,
        { pipeline, ...data }
      );
    }

    return this.userFeedModel.aggregate(pipeline);
  }
}

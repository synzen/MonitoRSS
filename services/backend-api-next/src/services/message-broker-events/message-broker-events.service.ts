import type { Connection, Consumer } from "rabbitmq-client";
import type { Config } from "../../config";
import logger from "../../infra/logger";
import { createConsumer, MessageBrokerQueue } from "../../infra/rabbitmq";
import type {
  IUserFeed,
  IUserFeedRepository,
  UserFeedForDelivery,
} from "../../repositories/interfaces/user-feed.types";
import type { IDiscordChannelConnection } from "../../repositories/interfaces/feed-connection.types";
import {
  UserFeedDisabledCode,
  UserFeedHealthStatus,
} from "../../repositories/shared/enums";
import { FeedFetcherFetchStatus } from "../feed-fetcher-api/types";
import type { SupportersService } from "../supporters/supporters.service";
import type { NotificationsService } from "../notifications/notifications.service";
import { ArticleRejectCode } from "../../shared/enums/article-reject-code";
import { FeedRejectCode } from "../../shared/enums/feed-reject-code";
import { getConnectionDisableCodeByArticleRejectCode } from "../../shared/utils/get-connection-disable-code-by-article-reject-code";
import { getUserFeedDisableCodeByFeedRejectCode } from "../../shared/utils/get-user-feed-disable-code-by-feed-reject-code";
import { getFeedRequestLookupDetails } from "../../shared/utils/get-feed-request-lookup-details";
import { castDiscordContentForMedium } from "../../shared/utils/cast-discord-content-for-medium";
import { castDiscordEmbedsForMedium } from "../../shared/utils/cast-discord-embeds-for-medium";
import { castDiscordComponentRowsForMedium } from "../../shared/utils/cast-discord-component-rows-for-medium";
import type { DiscordMediumEvent, UserForDelivery } from "./types";

export interface MessageBrokerEventsServiceDeps {
  config: Config;
  connection: Connection;
  userFeedRepository: IUserFeedRepository;
  supportersService: SupportersService;
  notificationsService: NotificationsService;
  publishMessage: (
    queue: string,
    message: unknown,
    options?: { expiration?: number },
  ) => Promise<void>;
}

export class MessageBrokerEventsService {
  private consumers: Consumer[] = [];

  constructor(private readonly deps: MessageBrokerEventsServiceDeps) {}

  async initialize(): Promise<void> {
    const createQueueConsumer = createConsumer(this.deps.connection);

    logger.info("Registering message broker consumers...");

    this.consumers.push(
      createQueueConsumer(MessageBrokerQueue.SyncSupporterDiscordRoles, (msg) =>
        this.handleSyncSupporterDiscordRoles(
          msg as { data: { userId: string } },
        ),
      ),
    );

    this.consumers.push(
      createQueueConsumer(MessageBrokerQueue.UrlFailing, (msg) =>
        this.handleUrlFailing(
          msg as { data: { lookupKey?: string; url: string } },
        ),
      ),
    );

    this.consumers.push(
      createQueueConsumer(MessageBrokerQueue.UrlFetchCompleted, (msg) =>
        this.handleUrlFetchCompletedEvent(
          msg as {
            data: {
              url: string;
              lookupKey?: string;
              rateSeconds: number;
              debug?: boolean;
            };
          },
        ),
      ),
    );

    this.consumers.push(
      createQueueConsumer(MessageBrokerQueue.UrlRejectedDisableFeeds, (msg) =>
        this.handleUrlRejectedDisableFeedsEvent(msg as any),
      ),
    );

    this.consumers.push(
      createQueueConsumer(MessageBrokerQueue.UrlFailedDisableFeeds, (msg) =>
        this.handleUrlRequestFailureEvent(
          msg as { data: { url: string; lookupKey?: string } },
        ),
      ),
    );

    this.consumers.push(
      createQueueConsumer(MessageBrokerQueue.FeedRejectedDisableFeed, (msg) =>
        this.handleFeedRejectedDisableFeed(msg as any),
      ),
    );

    this.consumers.push(
      createQueueConsumer(
        MessageBrokerQueue.FeedRejectedArticleDisableConnection,
        (msg) => this.handleRejectedArticleDisableConnection(msg as any),
      ),
    );

    logger.info(
      `Registered ${this.consumers.length} message broker consumers for queues: ` +
        `${MessageBrokerQueue.SyncSupporterDiscordRoles}, ` +
        `${MessageBrokerQueue.UrlFailing}, ` +
        `${MessageBrokerQueue.UrlFetchCompleted}, ` +
        `${MessageBrokerQueue.UrlRejectedDisableFeeds}, ` +
        `${MessageBrokerQueue.UrlFailedDisableFeeds}, ` +
        `${MessageBrokerQueue.FeedRejectedDisableFeed}, ` +
        `${MessageBrokerQueue.FeedRejectedArticleDisableConnection}`,
    );
  }

  async close(): Promise<void> {
    await Promise.all(this.consumers.map((c) => c.close()));
    logger.info("Message broker consumers closed");
  }

  async handleSyncSupporterDiscordRoles({
    data: { userId },
  }: {
    data: { userId: string };
  }): Promise<void> {
    logger.info(`User ${userId} has joined support server`);
    await this.deps.supportersService.syncDiscordSupporterRoles(userId);
  }

  async handleUrlFailing({
    data: { lookupKey, url },
  }: {
    data: { lookupKey?: string; url: string };
  }): Promise<void> {
    await this.deps.userFeedRepository.updateHealthStatusByFilter(
      lookupKey ? { lookupKey } : { url },
      UserFeedHealthStatus.Failing,
      UserFeedHealthStatus.Failing,
    );
  }

  async handleUrlFetchCompletedEvent({
    data: { url, lookupKey, rateSeconds, debug },
  }: {
    data: {
      url: string;
      lookupKey?: string;
      rateSeconds: number;
      debug?: boolean;
    };
  }): Promise<void> {
    if (debug) {
      logger.info(`DEBUG ${lookupKey || url}: In url fetch completed`, {
        url,
        lookupKey,
        rateSeconds,
      });
    }

    logger.debug("Got url fetched event", { lookupKey, url, rateSeconds });

    const filter = lookupKey ? { lookupKey } : { url };
    const healthStatusUpdateCount =
      await this.deps.userFeedRepository.countWithHealthStatusFilter(
        filter,
        UserFeedHealthStatus.Ok,
      );

    if (healthStatusUpdateCount > 0) {
      await this.deps.userFeedRepository.updateHealthStatusByFilter(
        filter,
        UserFeedHealthStatus.Ok,
        UserFeedHealthStatus.Ok,
      );
    }

    const feedIterator = lookupKey
      ? this.deps.userFeedRepository.iterateFeedsWithLookupKeysForDelivery({
          lookupKey,
          refreshRateSeconds: rateSeconds,
          debug,
        })
      : this.deps.userFeedRepository.iterateFeedsForDelivery({
          url,
          refreshRateSeconds: rateSeconds,
          debug,
        });

    for await (const feed of feedIterator) {
      try {
        if (feed.debug) {
          logger.info(`DEBUG ${feed.id}: Handling url fetch completed event`, {
            feed,
          });
        }

        const allConnections = Object.values(feed.connections).flat() as Array<{
          customPlaceholders?: unknown[];
        }>;
        const hasCustomPlaceholders = allConnections.some(
          (c) => !!c.customPlaceholders?.length,
        );
        const hasExternalProperties =
          feed.externalProperties && feed.externalProperties.length > 0;
        const hasPremiumFeatures =
          hasCustomPlaceholders || hasExternalProperties;

        let allowCustomPlaceholders = false;
        let allowExternalProperties = false;

        if (hasPremiumFeatures) {
          const benefits =
            await this.deps.supportersService.getBenefitsOfDiscordUser(
              feed.user.discordUserId,
            );

          allowCustomPlaceholders = benefits.allowCustomPlaceholders;
          allowExternalProperties = benefits.allowExternalProperties;
        }

        await this.emitDeliverFeedArticlesEvent({
          userFeed: feed,
          maxDailyArticles: feed.maxDailyArticles || 0,
          parseCustomPlaceholders: allowCustomPlaceholders,
          parseExternalProperties: allowExternalProperties,
          user: feed.users[0],
        });
      } catch (err) {
        logger.error(
          `Failed to emit deliver feed articles event for feed ${feed.id}: ${
            (err as Error).message
          }`,
          {
            stack: (err as Error).stack,
          },
        );
      }
    }
  }

  async handleUrlRejectedDisableFeedsEvent({
    data: { url, status, lookupKey },
  }: {
    data: {
      url: string;
      lookupKey?: string;
      status: FeedFetcherFetchStatus.RefusedLargeFeed;
    };
  }): Promise<void> {
    logger.debug(`handling url rejected disable feeds event for url ${url}`);

    if (status === FeedFetcherFetchStatus.RefusedLargeFeed) {
      const filter = lookupKey ? { lookupKey } : { url };
      await this.deps.userFeedRepository.disableFeedsByFilterIfNotDisabled(
        filter,
        UserFeedDisabledCode.FeedTooLarge,
      );
    }
  }

  async handleUrlRequestFailureEvent({
    data: { url, lookupKey },
  }: {
    data: { url: string; lookupKey?: string };
  }): Promise<void> {
    logger.debug(`handling url request failure event for url ${url}`);

    const filter = lookupKey ? { lookupKey } : { url };
    const feedIds =
      await this.deps.userFeedRepository.findIdsWithoutDisabledCode(filter);

    if (feedIds.length > 0) {
      await this.deps.userFeedRepository.disableFeedsAndSetHealthStatus(
        feedIds,
        UserFeedDisabledCode.FailedRequests,
        UserFeedHealthStatus.Failed,
      );

      try {
        await this.deps.notificationsService.sendDisabledFeedsAlert(feedIds, {
          disabledCode: UserFeedDisabledCode.FailedRequests,
        });
      } catch (err) {
        logger.error(`Failed to send disabled feeds alert`, {
          stack: (err as Error).stack,
        });
      }
    }
  }

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
  }): Promise<void> {
    const foundFeed = await this.deps.userFeedRepository.findById(feedId);

    if (!foundFeed) {
      logger.warn(
        `No feed with ID ${feedId} was found when attempting to` +
          ` handle message from ${MessageBrokerQueue.FeedRejectedDisableFeed}`,
      );
      return;
    }

    const disabledCode = getUserFeedDisableCodeByFeedRejectCode(rejectedCode);

    const wasDisabled =
      await this.deps.userFeedRepository.disableFeedByIdIfNotDisabled(
        feedId,
        disabledCode,
      );

    if (!wasDisabled) {
      return;
    }

    try {
      logger.info(
        `Preparing to send disabled feeds alert to ${foundFeed.id} for reason ${disabledCode}`,
      );
      await this.deps.notificationsService.sendDisabledFeedsAlert(
        [foundFeed.id],
        {
          disabledCode,
        },
      );
    } catch (err) {
      logger.error(`Failed to send disabled feeds alert`, {
        stack: (err as Error).stack,
      });
    }
  }

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
  }): Promise<void> {
    const foundFeed = await this.deps.userFeedRepository.findById(feedId);

    if (!foundFeed) {
      logger.warn(
        `No feed with ID ${feedId} was found when attempting to` +
          ` handle message from ${MessageBrokerQueue.FeedRejectedArticleDisableConnection}`,
      );
      return;
    }

    const connectionEntries = Object.entries(foundFeed.connections) as Array<
      [keyof IUserFeed["connections"], IDiscordChannelConnection[]]
    >;

    const disableCode =
      getConnectionDisableCodeByArticleRejectCode(rejectedCode);

    for (const [connectionKey, connections] of connectionEntries) {
      for (let conIdx = 0; conIdx < connections.length; ++conIdx) {
        const connection = connections[conIdx]!;

        if (connection.id !== mediumId) {
          continue;
        }

        await this.deps.userFeedRepository.setConnectionDisabledCode(
          feedId,
          connectionKey,
          conIdx,
          disableCode,
          rejectedMessage,
        );

        try {
          logger.info(
            `Sending disabled feed connection alert notification for ${foundFeed.id}, ${connection.id}`,
          );
          await this.deps.notificationsService.sendDisabledFeedConnectionAlert(
            foundFeed,
            connection,
            {
              disabledCode: disableCode,
              articleId,
              rejectedMessage,
            },
          );
        } catch (err) {
          logger.error(
            "Failed to send disabled feed connection alert in notifications service",
            {
              stack: (err as Error).stack,
            },
          );
        }

        break;
      }
    }
  }

  async emitDeliverFeedArticlesEvent({
    userFeed,
    maxDailyArticles,
    parseCustomPlaceholders,
    parseExternalProperties,
    user,
  }: {
    userFeed: UserFeedForDelivery | IUserFeed;
    maxDailyArticles: number;
    parseCustomPlaceholders: boolean;
    parseExternalProperties?: boolean;
    user?: UserForDelivery;
  }): Promise<void> {
    const discordChannelMediums = userFeed.connections.discordChannels
      .filter((c) => !c.disabledCode)
      .map<DiscordMediumEvent>((con) => ({
        id: con.id,
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
            con.details.componentRows,
          ),
          componentsV2: con.details.componentsV2,
          forumThreadTitle: con.details.forumThreadTitle,
          forumThreadTags: con.details.forumThreadTags,
          mentions: con.mentions,
          customPlaceholders: parseCustomPlaceholders
            ? (con.customPlaceholders as unknown as Array<
                Record<string, unknown>
              >)
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
      feed: {
        url: userFeed.url,
        feedRequestLookupKey:
          "feedRequestLookupKey" in userFeed
            ? userFeed.feedRequestLookupKey
            : undefined,
      },
      user: {
        externalCredentials: user?.externalCredentials,
      },
      decryptionKey: this.deps.config.BACKEND_API_ENCRYPTION_KEY_HEX,
    });

    const publishData = {
      articleDayLimit: maxDailyArticles,
      feed: {
        id: userFeed.id,
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

    const feedId = userFeed.id;
    const debug = "debug" in userFeed ? userFeed.debug : false;

    if (debug) {
      logger.info(`DEBUG ${feedId}: Emitting event`, {
        data: publishData,
      });
    }

    await this.deps.publishMessage(
      MessageBrokerQueue.FeedDeliverArticles,
      {
        debug,
        timestamp: Date.now(),
        data: publishData,
        source: "backend-api::message-broker-events",
      },
      {
        expiration: 1000 * 60 * 10, // 10 minutes
      },
    );

    logger.debug("successfully emitted deliver feed articles event");
  }
}

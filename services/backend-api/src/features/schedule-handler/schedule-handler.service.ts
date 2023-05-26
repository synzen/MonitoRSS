import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { FeedSchedule } from "../feeds/entities/feed-schedule.entity";
import { FeedSchedulingService } from "../feeds/feed-scheduling.service";
import { SupportersService } from "../supporters/supporters.service";
import { FilterQuery, Types } from "mongoose";
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

interface PublishFeedDeliveryArticlesData {
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
    private readonly feedSchedulingService: FeedSchedulingService,
    @InjectModel(UserFeed.name) private readonly userFeedModel: UserFeedModel,
    private readonly amqpConnection: AmqpConnection
  ) {
    this.defaultRefreshRateSeconds =
      (this.configService.get<number>(
        "BACKEND_API_DEFAULT_REFRESH_RATE_MINUTES"
      ) as number) * 60;
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

    await this.userFeedModel.updateMany(
      {
        url,
      },
      {
        $set: {
          disabledCode: UserFeedDisabledCode.FailedRequests,
          healthStatus: UserFeedHealthStatus.Failed,
        },
      }
    );
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
        _id: feedId,
      },
      {
        $set: {
          disabledCode,
        },
      }
    );
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
          },
          {
            $set: {
              [`connections.${connectionKey}.${conIdx}.disabledCode`]:
                disableCode,
            },
          }
        );
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

  emitDeliverFeedArticlesEvent({
    userFeed,
    maxDailyArticles,
  }: {
    userFeed: UserFeed;
    maxDailyArticles: number;
  }) {
    const discordChannelMediums =
      userFeed.connections.discordChannels.map<DiscordMediumEvent>((con) => ({
        id: con.id.toHexString(),
        key: "discord",
        filters: con.filters?.expression
          ? { expression: con.filters.expression }
          : null,
        details: {
          guildId: con.details.channel.guildId,
          channel: {
            id: con.details.channel.id,
            type: con.details.channel.type,
          },
          content: castDiscordContentForMedium(con.details.content),
          embeds: castDiscordEmbedsForMedium(con.details.embeds),
          forumThreadTitle: con.details.forumThreadTitle,
          formatter: {
            formatTables: con.details.formatter?.formatTables,
            stripImages: con.details.formatter?.stripImages,
          },
          splitOptions: con.splitOptions?.isEnabled
            ? con.splitOptions
            : undefined,
        },
      }));

    const discordWebhookMediums =
      userFeed.connections.discordWebhooks.map<DiscordMediumEvent>((con) => ({
        id: con.id.toHexString(),
        key: "discord",
        filters: con.filters?.expression
          ? { expression: con.filters.expression }
          : null,
        details: {
          guildId: con.details.webhook.guildId,
          webhook: {
            id: con.details.webhook.id,
            token: con.details.webhook.token,
            name: con.details.webhook.name,
            iconUrl: con.details.webhook.iconUrl,
          },
          content: castDiscordContentForMedium(con.details.content),
          embeds: castDiscordEmbedsForMedium(con.details.embeds),
          formatter: {
            formatTables: con.details.formatter?.formatTables,
            stripImages: con.details.formatter?.stripImages,
          },
          splitOptions: con.splitOptions?.isEnabled
            ? con.splitOptions
            : undefined,
        },
      }));

    const allMediums = discordChannelMediums.concat(discordWebhookMediums);

    this.amqpConnection.publish<PublishFeedDeliveryArticlesData>(
      "",
      MessageBrokerQueue.FeedDeliverArticles,
      {
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
      urlHandler,
      feedHandler,
    }: {
      urlHandler: (url: string) => Promise<void>;
      feedHandler: (
        feed: UserFeed,
        {
          maxDailyArticles,
        }: {
          maxDailyArticles: number;
        }
      ) => Promise<void>;
    }
  ) {
    const allBenefits =
      await this.supportersService.getBenefitsOfAllDiscordUsers();

    const dailyLimitsByDiscordUserId = new Map<string, number>(
      allBenefits.map<[string, number]>((benefit) => [
        benefit.discordUserId,
        benefit.maxDailyArticles,
      ])
    );

    const urls = await this.getUrlsMatchingRefreshRate(refreshRateSeconds);

    logger.debug(
      `Found ${urls.length} urls with refresh rate ${refreshRateSeconds}`,
      {
        urls,
      }
    );

    await Promise.all(urls.map((url) => urlHandler(url)));

    const feedCursor = await this.getFeedCursorMatchingRefreshRate(
      refreshRateSeconds
    );

    for await (const feed of feedCursor) {
      const discordUserId = feed.user.discordUserId;
      const maxDailyArticles =
        dailyLimitsByDiscordUserId.get(discordUserId) ||
        this.supportersService.maxDailyArticlesDefault;

      await feedHandler(feed, {
        maxDailyArticles,
      });
    }
  }

  async getUrlsMatchingRefreshRate(
    refreshRateSeconds: number
  ): Promise<string[]> {
    const isDefaultRefreshRate =
      refreshRateSeconds === this.defaultRefreshRateSeconds;

    const discordSupporters = await this.getValidDiscordUserSupporters();

    if (isDefaultRefreshRate) {
      logger.debug(`${refreshRateSeconds}s is default refresh rate`);

      const discordUserIdsToExclude = discordSupporters
        .filter(({ refreshRateSeconds: rate }) => rate !== refreshRateSeconds)
        .map(({ discordUserId }) => discordUserId);

      const excludeSchedules =
        await this.feedSchedulingService.findSchedulesNotMatchingRefreshRate(
          refreshRateSeconds
        );

      return this.getScheduleFeedQueryExcluding(
        excludeSchedules,
        discordUserIdsToExclude
      ).distinct("url");
    }

    const discordUserIdsToInclude = discordSupporters
      .filter(({ refreshRateSeconds: rate }) => rate === refreshRateSeconds)
      .map(({ discordUserId }) => discordUserId);

    const schedules = await this.getSchedulesOfRefreshRate(refreshRateSeconds);

    return this.getFeedsQueryWithScheduleAndUsers(
      schedules,
      discordUserIdsToInclude
    ).distinct("url");
  }

  async getFeedCursorMatchingRefreshRate(refreshRateSeconds: number) {
    const isDefaultRefreshRate =
      refreshRateSeconds === this.defaultRefreshRateSeconds;

    const discordSupporters = await this.getValidDiscordUserSupporters();

    if (isDefaultRefreshRate) {
      const discordUserIdsToExclude = discordSupporters
        .filter(({ refreshRateSeconds: rate }) => rate !== refreshRateSeconds)
        .map(({ discordUserId }) => discordUserId);

      const excludeSchedules =
        await this.feedSchedulingService.findSchedulesNotMatchingRefreshRate(
          refreshRateSeconds
        );

      return this.getScheduleFeedQueryExcluding(
        excludeSchedules,
        discordUserIdsToExclude
      ).cursor();
    }

    const discordUserIdsToInclude = discordSupporters
      .filter(({ refreshRateSeconds: rate }) => rate === refreshRateSeconds)
      .map(({ discordUserId }) => discordUserId);

    const schedules = await this.getSchedulesOfRefreshRate(refreshRateSeconds);

    return this.getFeedsQueryWithScheduleAndUsers(
      schedules,
      discordUserIdsToInclude
    ).cursor();
  }

  async getValidDiscordUserSupporters() {
    const allBenefits =
      await this.supportersService.getBenefitsOfAllDiscordUsers();

    return allBenefits.filter(({ isSupporter }) => isSupporter);
  }

  getSchedulesOfRefreshRate(refreshRateSeconds: number) {
    return this.feedSchedulingService.findSchedulesOfRefreshRate(
      refreshRateSeconds
    );
  }

  getFeedsQueryWithScheduleAndUsers(
    schedules: FeedSchedule[],
    discordUserIdsToInclude: string[]
  ) {
    const withConnectionsQuery = {
      $or: [
        {
          "connections.discordChannels.0": {
            $exists: true,
          },
        },
        {
          "connections.discordWebhooks.0": {
            $exists: true,
          },
        },
      ],
    };
    const keywordConditions = schedules
      .map((schedule) => schedule.keywords)
      .flat()
      .map((keyword) => ({
        url: new RegExp(keyword, "i"),
        disabledCode: {
          $exists: false,
        },
        healthStatus: {
          $ne: UserFeedHealthStatus.Failed,
        },
        ...withConnectionsQuery,
      }));

    const query: FilterQuery<UserFeedDocument> = {
      $or: [
        ...keywordConditions,
        {
          "user.discordUserId": {
            $in: discordUserIdsToInclude,
          },
          disabledCode: {
            $exists: false,
          },
          healthStatus: {
            $ne: UserFeedHealthStatus.Failed,
          },
          ...withConnectionsQuery,
        },
        {
          _id: {
            $in: schedules
              .map((schedule) =>
                schedule.feeds.map((id) => new Types.ObjectId(id))
              )
              .flat(),
          },
          disabledCode: {
            $exists: false,
          },
          healthStatus: {
            $ne: UserFeedHealthStatus.Failed,
          },
          ...withConnectionsQuery,
        },
      ],
    };

    return this.userFeedModel.find(query);
  }

  getScheduleFeedQueryExcluding(
    schedulesToExclude: FeedSchedule[],
    discordUserIdsToExclude: string[]
  ) {
    const keywordConditions = schedulesToExclude
      .map((schedule) => schedule.keywords)
      .flat()
      .map((keyword) => ({
        url: {
          $not: new RegExp(keyword, "i"),
        },
      }));

    const feedIdConditions = schedulesToExclude
      .map((schedule) => schedule.feeds.map((id) => new Types.ObjectId(id)))
      .flat();

    const query: FilterQuery<UserFeedDocument> = {
      $and: [
        {
          disabledCode: {
            $exists: false,
          },
          healthStatus: {
            $ne: UserFeedHealthStatus.Failed,
          },
        },
        {
          "user.discordUserId": {
            $nin: discordUserIdsToExclude,
          },
        },
        ...keywordConditions,
        {
          _id: {
            $nin: feedIdConditions,
          },
        },
        {
          $or: [
            {
              "connections.discordChannels.0": {
                $exists: true,
              },
            },
            {
              "connections.discordWebhooks.0": {
                $exists: true,
              },
            },
          ],
        },
      ],
    };

    return this.userFeedModel.find(query);
  }
}

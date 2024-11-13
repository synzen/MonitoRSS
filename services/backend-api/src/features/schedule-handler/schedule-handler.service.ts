import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { SupportersService } from "../supporters/supporters.service";
import logger from "../../utils/logger";

import { UserFeed, UserFeedModel } from "../user-feeds/entities";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";

import { MessageBrokerQueue } from "../../common/constants/message-broker-queue.constants";
import { UserFeedsService } from "../user-feeds/user-feeds.service";
import { getCommonFeedAggregateStages } from "../../common/utils";
import getFeedRequestLookupDetails from "../../utils/get-feed-request-lookup-details";

@Injectable()
export class ScheduleHandlerService {
  defaultRefreshRateSeconds: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly supportersService: SupportersService,
    @InjectModel(UserFeed.name) private readonly userFeedModel: UserFeedModel,
    private readonly amqpConnection: AmqpConnection,
    private readonly userFeedsService: UserFeedsService
  ) {
    this.defaultRefreshRateSeconds =
      (this.configService.get<number>(
        "BACKEND_API_DEFAULT_REFRESH_RATE_MINUTES"
      ) as number) * 60;
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

    // With batched URLs
    const urlsCursor =
      this.getUrlsQueryMatchingRefreshRate(refreshRateSeconds).cursor();

    let urlBatch: {
      url: string;
      saveToObjectStorage?: boolean;
      lookupKey?: string;
      headers?: Record<string, string>;
    }[] = [];

    for await (const { _id: url } of urlsCursor) {
      if (!url) {
        // Just in case
        continue;
      }

      urlBatch.push({
        url,
        saveToObjectStorage: urlsToDebug.has(url),
      });

      if (urlBatch.length === 25) {
        await urlsHandler(urlBatch);
        urlBatch = [];
      }
    }

    // With feed request lookup keys
    const unbatchedUrlsCursor =
      this.getUnbatchedUrlsQueryMatchingRefreshRate(
        refreshRateSeconds
      ).cursor();

    for await (const {
      _id,
      url,
      feedRequestLookupKey,
      users,
    } of unbatchedUrlsCursor) {
      if (!url || !feedRequestLookupKey) {
        throw new Error(
          `Missing url or feedRequestLookupKey for document ${_id}`
        );
      }

      const user = users[0];
      const externalCredentials = user?.externalCredentials;

      const lookupDetails = getFeedRequestLookupDetails({
        feed: {
          url: url,
          feedRequestLookupKey,
        },
        user: {
          externalCredentials: externalCredentials,
        },
        decryptionKey: this.configService.get("BACKEND_API_ENCRYPTION_KEY"),
      });

      urlBatch.push({
        url: lookupDetails?.url || url,
        saveToObjectStorage: urlsToDebug.has(url),
        lookupKey: feedRequestLookupKey,
        headers: lookupDetails?.headers,
      });

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
    const pipeline = getCommonFeedAggregateStages({ refreshRateSeconds });

    pipeline.push({
      $group: {
        _id: "$url",
      },
    });

    return this.userFeedModel.aggregate(pipeline);
  }

  getUnbatchedUrlsQueryMatchingRefreshRate(refreshRateSeconds: number) {
    const pipeline = getCommonFeedAggregateStages({
      refreshRateSeconds,
      withLookupKeys: true,
    });

    pipeline.push({
      $project: {
        url: 1,
        feedRequestLookupKey: 1,
        users: 1,
      },
    });

    return this.userFeedModel.aggregate(pipeline);
  }
  async getValidDiscordUserSupporters() {
    const allBenefits =
      await this.supportersService.getBenefitsOfAllDiscordUsers();

    return allBenefits.filter(({ isSupporter }) => isSupporter);
  }

  async enforceUserFeedLimits() {
    const benefits =
      await this.supportersService.getBenefitsOfAllDiscordUsers();

    await this.userFeedsService.enforceUserFeedLimits(
      benefits.map(({ discordUserId, maxUserFeeds, refreshRateSeconds }) => ({
        discordUserId,
        maxUserFeeds,
        refreshRateSeconds,
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

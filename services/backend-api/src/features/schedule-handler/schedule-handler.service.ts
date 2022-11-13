import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { FeedSchedule } from "../feeds/entities/feed-schedule.entity";
import { FeedSchedulingService } from "../feeds/feed-scheduling.service";
import { SupportersService } from "../supporters/supporters.service";
import { FilterQuery, Types } from "mongoose";
import logger from "../../utils/logger";
import { UserFeedHealthStatus } from "../user-feeds/types";
import {
  UserFeed,
  UserFeedDocument,
  UserFeedModel,
} from "../user-feeds/entities";

@Injectable()
export class ScheduleHandlerService {
  awsUrlRequestQueueUrl: string;
  awsUrlRequestSqsClient: SQSClient;
  defaultRefreshRateSeconds: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly supportersService: SupportersService,
    private readonly feedSchedulingService: FeedSchedulingService,
    @InjectModel(UserFeed.name) private readonly userFeedModel: UserFeedModel
  ) {
    this.awsUrlRequestQueueUrl = configService.get(
      "AWS_URL_REQUEST_QUEUE_URL"
    ) as string;
    const awsUrlRequestQueueRegion = configService.get(
      "AWS_URL_REQUEST_QUEUE_REGION"
    ) as string;
    const awsUrlRequestQueueEndpoint = configService.get(
      "AWS_URL_REQUEST_QUEUE_ENDPOINT"
    );
    this.awsUrlRequestSqsClient = new SQSClient({
      region: awsUrlRequestQueueRegion,
      endpoint: awsUrlRequestQueueEndpoint,
    });

    this.defaultRefreshRateSeconds =
      (this.configService.get<number>(
        "DEFAULT_REFRESH_RATE_MINUTES"
      ) as number) * 60;
  }

  async emitUrlRequestEvent(data: { url: string; rateSeconds: number }) {
    const res = await this.awsUrlRequestSqsClient.send(
      new SendMessageCommand({
        MessageBody: JSON.stringify(data),
        QueueUrl: this.awsUrlRequestQueueUrl,
      })
    );

    logger.debug("success", {
      res,
    });
  }

  async handleRefreshRate(
    refreshRateSeconds: number,
    {
      urlHandler,
      feedHandler,
    }: {
      urlHandler: (url: string) => Promise<void>;
      feedHandler: (feed: UserFeed) => Promise<void>;
    }
  ) {
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
      await feedHandler(feed);
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
      ],
    };

    return this.userFeedModel.find(query);
  }
}

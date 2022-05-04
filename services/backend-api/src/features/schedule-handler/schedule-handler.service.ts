import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { SqsPollingService } from '../../common/services/sqs-polling.service';
import { FeedSchedule } from '../feeds/entities/feed-schedule.entity';
import { Feed, FeedDocument, FeedModel } from '../feeds/entities/feed.entity';
import { FeedSchedulingService } from '../feeds/feed-scheduling.service';
import { SupportersService } from '../supporters/supporters.service';
import { FilterQuery, Types } from 'mongoose';
import logger from '../../utils/logger';

// interface ScheduleEvent {
//   refreshRateSeconds: number;
// }

@Injectable()
export class ScheduleHandlerService {
  awsUrlRequestQueueUrl: string;
  awsUrlRequestSqsClient: SQSClient;
  defaultRefreshRateSeconds: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly sqsPollingService: SqsPollingService,
    private readonly supportersService: SupportersService,
    private readonly feedSchedulingService: FeedSchedulingService,
    @InjectModel(Feed.name) private readonly feedModel: FeedModel,
  ) {
    this.awsUrlRequestQueueUrl = configService.get(
      'awsUrlRequestQueueUrl',
    ) as string;
    const awsUrlRequestQueueRegion = configService.get(
      'awsUrlRequestQueueRegion',
    ) as string;
    const awsUrlRequestQueueEndpoint = configService.get(
      'awsScheduleQueueEndpoint',
    ) as string;
    this.awsUrlRequestSqsClient = new SQSClient({
      region: awsUrlRequestQueueRegion,
      endpoint: awsUrlRequestQueueEndpoint,
    });

    this.defaultRefreshRateSeconds =
      (this.configService.get<number>('defaultRefreshRateMinutes') as number) *
      60;
  }

  async emitUrlRequestEvent(data: { url: string }) {
    const res = await this.awsUrlRequestSqsClient.send(
      new SendMessageCommand({
        MessageBody: JSON.stringify(data),
        QueueUrl: this.awsUrlRequestQueueUrl,
      }),
    );

    logger.debug('success', {
      res,
    });
  }

  // async pollForScheduleEvents(
  //   messageHandler: (message: ScheduleEvent) => Promise<void>,
  // ) {
  //   await this.sqsPollingService.pollQueue({
  //     awsQueueUrl: this.queueUrl,
  //     awsRegion: this.queueRegion,
  //     awsEndpoint: this.queueEndpoint,
  //     onMessageReceived: async (message: Message) => {
  //       if (!message.Body) {
  //         logger.error(
  //           `Queue ${this.queueUrl} message ${message.MessageId} has no body, skipping`,
  //           {
  //             message,
  //           },
  //         );

  //         return;
  //       }

  //       const messageBody = JSON.parse(message.Body);

  //       logger.debug(`Queue ${this.queueUrl} message received`, {
  //         message,
  //       });
  //       await messageHandler(messageBody);

  //       logger.debug(
  //         `Queue ${this.queueUrl} message processed ${message.MessageId}`,
  //       );
  //     },
  //   });
  // }

  async handleRefreshRate(
    refreshRateSeconds: number,
    {
      urlHandler,
      feedHandler,
    }: {
      urlHandler: (url: string) => Promise<void>;
      feedHandler: (feed: Feed) => Promise<void>;
    },
  ) {
    const urls = await this.getUrlsMatchingRefreshRate(refreshRateSeconds);

    logger.debug(
      `Found ${urls.length} urls with refresh rate ${refreshRateSeconds}`,
      {
        urls,
      },
    );

    await Promise.all(urls.map((url) => urlHandler(url)));

    const feedCursor = await this.getFeedCursorMatchingRefreshRate(
      refreshRateSeconds,
    );

    for await (const feed of feedCursor) {
      await feedHandler(feed);
    }
  }

  async getUrlsMatchingRefreshRate(
    refreshRateSeconds: number,
  ): Promise<string[]> {
    const isDefaultRefreshRate =
      refreshRateSeconds === this.defaultRefreshRateSeconds;

    const schedules = await this.getSchedulesOfRefreshRate(refreshRateSeconds);
    const serverIds = await this.getServerIdsWithRefreshRate(
      refreshRateSeconds,
    );

    if (isDefaultRefreshRate) {
      logger.debug(`${refreshRateSeconds}s is default refresh rate`);

      return this.getDefaultScheduleFeedQuery(schedules, serverIds).distinct(
        'url',
      );
    }

    return this.getFeedsQueryWithScheduleAndServers(
      schedules,
      serverIds,
    ).distinct('url');
  }

  async getFeedCursorMatchingRefreshRate(refreshRateSeconds: number) {
    const isDefaultRefreshRate =
      refreshRateSeconds === this.defaultRefreshRateSeconds;

    const schedules = await this.getSchedulesOfRefreshRate(refreshRateSeconds);
    const serverIds = await this.getServerIdsWithRefreshRate(
      refreshRateSeconds,
    );

    if (isDefaultRefreshRate) {
      return this.getDefaultScheduleFeedQuery(schedules, serverIds).cursor();
    }

    return this.getFeedsQueryWithScheduleAndServers(
      schedules,
      serverIds,
    ).cursor();
  }

  async getServerIdsWithRefreshRate(refreshRateSeconds: number) {
    const allBenefits = await this.supportersService.getBenefitsOfAllServers();
    const benefitsWithMatchedRefreshRate = allBenefits.filter(
      (benefit) => benefit.refreshRateSeconds === refreshRateSeconds,
    );

    return benefitsWithMatchedRefreshRate.map((benefit) => benefit.serverId);
  }

  getSchedulesOfRefreshRate(refreshRateSeconds: number) {
    return this.feedSchedulingService.findSchedulesOfRefreshRate(
      refreshRateSeconds,
    );
  }

  getFeedsQueryWithScheduleAndServers(
    schedules: FeedSchedule[],
    serverIds: string[],
  ) {
    const keywordConditions = schedules
      .map((schedule) => schedule.keywords)
      .flat()
      .map((keyword) => ({
        url: new RegExp(keyword, 'i'),
        disabled: {
          $exists: false,
        },
        isFeedv2: true,
      }));

    const query: FilterQuery<FeedDocument> = {
      $or: [
        ...keywordConditions,
        {
          guild: { $in: serverIds },
          disabled: {
            $exists: false,
          },
          isFeedv2: true,
        },
        {
          _id: {
            $in: schedules
              .map((schedule) =>
                schedule.feeds.map((id) => new Types.ObjectId(id)),
              )
              .flat(),
          },
          disabled: {
            $exists: false,
          },
          isFeedv2: true,
        },
      ],
    };

    return this.feedModel.find(query);
  }

  getDefaultScheduleFeedQuery(schedules: FeedSchedule[], serverIds: string[]) {
    const keywordConditions = schedules
      .map((schedule) => schedule.keywords)
      .flat()
      .map((keyword) => ({
        url: {
          $not: new RegExp(keyword, 'i'),
        },
        disabled: {
          $exists: false,
        },
        isFeedv2: true,
      }));

    const query: FilterQuery<FeedDocument> = {
      $and: [
        ...keywordConditions,
        {
          guild: { $nin: serverIds },
          disabled: {
            $exists: false,
          },
          isFeedv2: true,
        },
        {
          _id: {
            $nin: schedules
              .map((schedule) =>
                schedule.feeds.map((id) => new Types.ObjectId(id)),
              )
              .flat(),
          },
          disabled: {
            $exists: false,
          },
          isFeedv2: true,
        },
      ],
    };

    return this.feedModel.find(query);
  }
}

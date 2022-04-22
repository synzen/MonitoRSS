import { Message, SQSClient } from '@aws-sdk/client-sqs';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { SqsPollingService } from '../../common/services/sqs-polling.service';
import logger from '../../utils/logger';
import { FeedSchedule } from '../feeds/entities/feed-schedule.entity';
import { Feed, FeedDocument, FeedModel } from '../feeds/entities/feed.entity';
import { FeedSchedulingService } from '../feeds/feed-scheduling.service';
import { SupportersService } from '../supporters/supporters.service';
import { FilterQuery, Types } from 'mongoose';

interface ScheduleEvent {
  refreshRateSeconds: number;
}

@Injectable()
export class ScheduleHandlerService {
  queueRegion: string;
  queueUrl: string;
  queueEndpoint: string;
  sqsClient: SQSClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly sqsPollingService: SqsPollingService,
    private readonly supportersService: SupportersService,
    private readonly feedSchedulingService: FeedSchedulingService,
    @InjectModel(Feed.name) private readonly feedModel: FeedModel,
  ) {
    this.queueRegion = configService.get('awsScheduleQueueRegion') as string;
    this.queueUrl = configService.get('awsScheduleQueueUrl') as string;
    this.queueEndpoint = configService.get(
      'awsScheduleQueueEndpoint',
    ) as string;

    this.sqsClient = new SQSClient({
      region: this.queueRegion,
      endpoint: this.queueEndpoint,
    });
  }

  async pollForScheduleEvents(
    messageHandler: (message: ScheduleEvent) => Promise<void>,
  ) {
    await this.sqsPollingService.pollQueue({
      awsQueueUrl: this.queueUrl,
      awsRegion: this.queueRegion,
      awsEndpoint: this.queueEndpoint,
      onMessageReceived: async (message: Message) => {
        if (!message.Body) {
          logger.error(
            `Queue ${this.queueUrl} message ${message.MessageId} has no body, skipping`,
            {
              message,
            },
          );

          return;
        }

        const messageBody = JSON.parse(message.Body);

        logger.debug(`Queue ${this.queueUrl} message received`, {
          message,
        });
        await messageHandler(messageBody);

        logger.debug(
          `Queue ${this.queueUrl} message processed ${message.MessageId}`,
        );
      },
    });
  }

  async getUrlsMatchingRefreshRate(refreshRateSeconds: number) {
    const defaultRefreshRateSeconds =
      (this.configService.get<number>('defaultRefreshRateMinutes') as number) *
      60;
    const isDefaultRefreshRate =
      refreshRateSeconds === defaultRefreshRateSeconds;

    const schedules = await this.getSchedulesOfRefreshRate(refreshRateSeconds);
    const serverIds = await this.getServerIdsWithRefreshRate(
      refreshRateSeconds,
    );

    if (isDefaultRefreshRate) {
      return this.getDefaultFeedUrls(schedules, serverIds);
    }

    return this.getFeedUrlsWithScheduleAndServers(schedules, serverIds);
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

  getFeedUrlsWithScheduleAndServers(
    schedules: FeedSchedule[],
    serverIds: string[],
    options?: {
      invertQuery: boolean;
    },
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

    let query: FilterQuery<FeedDocument> = {
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

    if (options?.invertQuery) {
      query = {
        $not: query,
      };
    }

    return this.feedModel.find(query).distinct('url');
  }

  getDefaultFeedUrls(schedules: FeedSchedule[], serverIds: string[]) {
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
      }));

    const query: FilterQuery<FeedDocument> = {
      $and: [
        ...keywordConditions,
        {
          guild: { $nin: serverIds },
          disabled: {
            $exists: false,
          },
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
        },
      ],
    };

    return this.feedModel.find(query).distinct('url');
  }
}

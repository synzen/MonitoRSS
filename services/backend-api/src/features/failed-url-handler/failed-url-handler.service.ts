import { Message, SQSClient } from '@aws-sdk/client-sqs';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { SqsPollingService } from '../../common/services/sqs-polling.service';
import logger from '../../utils/logger';
import { FEED_DISABLED_CODES } from '../feeds/constants';
import { Feed, FeedModel } from '../feeds/entities/feed.entity';

interface FailedUrlEvent {
  url: string;
}

@Injectable()
export class FailedUrlHandlerService {
  queueRegion: string;
  queueUrl: string;
  queueEndpoint: string;
  sqsClient: SQSClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly sqsPollingService: SqsPollingService,
    @InjectModel(Feed.name) private readonly feedModel: FeedModel,
  ) {
    this.queueRegion = configService.get(
      'AWS_FAILED_URL_QUEUE_REGION',
    ) as string;
    this.queueUrl = configService.get('AWS_FAILED_URL_QUEUE_URL') as string;
    this.queueEndpoint = configService.get(
      'AWS_FAILED_URL_QUEUE_ENDPOINT',
    ) as string;

    this.sqsClient = new SQSClient({
      region: this.queueRegion,
      endpoint: this.queueEndpoint,
    });
  }

  async pollForFailedUrlEvents(
    messageHandler: (message: FailedUrlEvent) => Promise<void>,
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

  async disableFeedsWithUrl(url: string) {
    await this.feedModel.updateMany(
      {
        url,
        isFeedv2: true,
      },
      {
        $set: {
          disabled: FEED_DISABLED_CODES.CONNECTION_FAILURE,
        },
      },
    );
  }
}

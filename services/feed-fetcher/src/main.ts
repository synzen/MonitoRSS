import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { FeedFetcherService } from './feed-fetcher/feed-fetcher.service';
import { pollQueue } from './poll-queue';
import logger from './utils/logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule.forRoot());
  await app.listen(3000);
  await setupQueuePoll(app);
}

async function setupQueuePoll(app: INestApplication) {
  const configService = app.get(ConfigService);
  const queueUrl = configService.get('AWS_SQS_QUEUE_URL') as string;
  const region = configService.get('AWS_REGION') as string;
  const awsEndpoint = configService.get('AWS_SQS_QUEUE_SERVICE_ENDPOINT');

  const feedFetcherService = app.get(FeedFetcherService);

  await pollQueue({
    awsQueueUrl: queueUrl,
    awsRegion: region,
    awsEndpoint: awsEndpoint,
    onMessageReceived: async (message) => {
      if (!message.Body) {
        logger.error(
          `Queue ${queueUrl} message ${message.MessageId} has no body, skipping`,
          {
            message,
          },
        );

        return;
      }

      const { url } = JSON.parse(message.Body);

      if (!url) {
        logger.error(
          `Queue ${queueUrl} message ${message.MessageId} has no url, skipping`,
          {
            message,
          },
        );

        return;
      }

      logger.debug(`Queue ${queueUrl} message received`, {
        message,
      });
      await feedFetcherService.fetchAndSaveResponse(url);
      logger.debug(`Queue ${queueUrl} message processed ${message.MessageId}`);
    },
  });
}

bootstrap();

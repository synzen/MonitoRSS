import './utils/dd-tracer';
import { INestApplication, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { FeedFetcherService } from './feed-fetcher/feed-fetcher.service';
import { SqsPollingService } from './shared/services/sqs-polling.service';
import logger from './utils/logger';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import dayjs from 'dayjs';
import { SQSClient } from '@aws-sdk/client-sqs';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot(),
    new FastifyAdapter(),
  );

  app.enableVersioning({
    type: VersioningType.URI,
  });

  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>('API_PORT');

  await app.listen(port, '0.0.0.0');
  logger.info(`Application is running`);
  await setupQueuePoll(app);
}

async function setupQueuePoll(app: INestApplication) {
  const configService = app.get(ConfigService);
  const queueUrl = configService.get('AWS_SQS_REQUEST_QUEUE_URL') as string;
  const region = configService.get('AWS_SQS_REQUEST_QUEUE_REGION') as string;
  const awsEndpoint = configService.get('AWS_SQS_REQUEST_QUEUE_ENDPOINT');

  const feedFetcherService = app.get(FeedFetcherService);
  const sqsPollingService = app.get(SqsPollingService);

  const client = new SQSClient({
    endpoint: awsEndpoint,
    region: region,
  });

  await sqsPollingService.pollQueue(client, {
    queueUrl,
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

      const { url, rateSeconds } = JSON.parse(message.Body);

      if (!url || rateSeconds == null) {
        logger.error(
          `Queue ${queueUrl} message ${message.MessageId} has no url and/or rateSeconds, skipping`,
          {
            url,
            rateSeconds,
            message,
          },
        );

        return;
      }

      logger.debug(`Queue ${queueUrl} message received`, {
        message,
      });

      if (await requestHasBeenRecentlyProcessed(app, { url, rateSeconds })) {
        logger.debug(
          `Request ${url} with rate ${rateSeconds} has been recently processed, skipping`,
        );

        return;
      }

      await feedFetcherService.fetchAndSaveResponse(url);

      logger.debug(`Queue ${queueUrl} message processed ${message.MessageId}`);
    },
  });
}

async function requestHasBeenRecentlyProcessed(
  app: INestApplication,
  {
    url,
    rateSeconds,
  }: {
    url: string;
    rateSeconds: number;
  },
) {
  const feedFetcherService = app.get(FeedFetcherService);

  const dateToCheck = dayjs().subtract(rateSeconds, 'seconds').toDate();

  const requestExistsAfterTime =
    await feedFetcherService.requestExistsAfterTime({ url }, dateToCheck);

  return requestExistsAfterTime;
}

bootstrap();

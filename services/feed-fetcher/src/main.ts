import './utils/dd-tracer';
import { INestApplication, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { FeedFetcherService } from './feed-fetcher/feed-fetcher.service';
import logger from './utils/logger';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import dayjs from 'dayjs';
import { Consumer } from 'sqs-consumer';
import { SQS } from 'aws-sdk';
import https from 'https';

let consumer: Consumer | undefined;

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot(),
    new FastifyAdapter(),
  );

  app.enableVersioning({
    type: VersioningType.URI,
  });

  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>('FEED_FETCHER_API_PORT');
  const skipPollRequestQueue = configService.getOrThrow<boolean>(
    'FEED_FETCHER_SKIP_POLLING_SQS_REQUEST_QUEUE',
  );

  await app.listen(port, '0.0.0.0');
  logger.info(`Application is running`);

  if (!skipPollRequestQueue) {
    await setupQueuePoll(app);
  }
}

async function setupQueuePoll(app: INestApplication) {
  const configService = app.get(ConfigService);
  const feedFetcherService = app.get(FeedFetcherService);

  const queueUrl = configService.get(
    'FEED_FETCHER_AWS_SQS_REQUEST_QUEUE_URL',
  ) as string;
  const region = configService.get(
    'FEED_FETCHER_AWS_SQS_REQUEST_QUEUE_REGION',
  ) as string;
  const awsEndpoint = configService.get(
    'FEED_FETCHER_AWS_SQS_REQUEST_QUEUE_ENDPOINT',
  );

  consumer = Consumer.create({
    queueUrl,
    region,
    sqs: queueUrl.startsWith('https')
      ? new SQS({
          region,
          endpoint: awsEndpoint,
          httpOptions: {
            agent: new https.Agent({
              keepAlive: true,
            }),
          },
        })
      : undefined,
    batchSize: 10,
    handleMessage: async (message) => {
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

  consumer.on('error', (error, message) => {
    console.log('Cosnsumer encountered error', { error, message });
  });

  consumer.on('processing_error', (error, message) => {
    console.log('Cosnsumer encountered processing error', { error, message });
  });

  consumer.on('timeout_error', (error, message) => {
    console.log('Consumer encountered timeout error', { error, message });
  });

  consumer.on('stopped', () => {
    console.log('Consumer stopped');
  });

  consumer.start();
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

process.on('SIGTERM', () => {
  console.log('SIGTERM received, stopping feed event consumer');
  consumer?.stop();
});

bootstrap();

import {
  INestApplication,
  INestMicroservice,
  VersioningType,
} from '@nestjs/common';
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

async function bootstrap() {
  // const app = await NestFactory.createMicroservice<MicroserviceOptions>(
  //   AppModule.forRoot(),
  //   {
  //     transport: Transport.GRPC,
  //     options: {
  //       package: 'feedfetcher',
  //       protoPath: join(__dirname, './feed-fetcher/feed-fetcher.proto'),
  //       url: '0.0.0.0:5000',
  //     },
  //   },
  // );
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot(),
    new FastifyAdapter(),
  );

  app.enableVersioning({
    type: VersioningType.URI,
  });

  // app.connectMicroservice();
  // await app.startAllMicroservices();

  await app.listen(5000, '0.0.0.0');
  logger.info(`Application is running`);
  await setupQueuePoll(app);
}

async function setupQueuePoll(app: INestApplication | INestMicroservice) {
  const configService = app.get(ConfigService);
  const queueUrl = configService.get('AWS_SQS_QUEUE_URL') as string;
  const region = configService.get('AWS_REGION') as string;
  const awsEndpoint = configService.get('AWS_SQS_QUEUE_SERVICE_ENDPOINT');

  const feedFetcherService = app.get(FeedFetcherService);
  const sqsPollingService = app.get(SqsPollingService);

  await sqsPollingService.pollQueue({
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

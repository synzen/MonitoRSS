import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import {
  AllExceptionsFilter,
  AllMicroserviceExceptionsFilter,
} from './shared/filters';
import logger from './utils/logger';
import { MikroORM } from '@mikro-orm/core';
import { RequestContext } from '@mikro-orm/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import compression from '@fastify/compress';

async function startApi() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forApi(),
    new FastifyAdapter(),
  );

  app.register(compression, {
    encodings: ['gzip', 'deflate'],
  });

  const microservice =
    await NestFactory.createMicroservice<MicroserviceOptions>(
      AppModule.forApi(),
      {
        transport: Transport.GRPC,
        options: {
          package: 'feedfetcher',
          protoPath: join(__dirname, './feed-fetcher/feed-fetcher.proto'),
          url: '0.0.0.0:4999',
        },
      },
    );

  microservice.enableShutdownHooks();
  app.enableShutdownHooks();

  const orm = app.get(MikroORM);
  const httpAdapterHost = app.get(HttpAdapterHost);

  app.use((req, res, next) => {
    RequestContext.create(orm.em, next);
  });
  microservice.useGlobalFilters(new AllMicroserviceExceptionsFilter());
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'v',
  });

  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>('FEED_REQUESTS_API_PORT');

  await microservice.listen();
  await app.listen(port, '0.0.0.0');

  setInterval(() => {
    tryDbConnection(orm).catch(() => process.exit(1));
  }, 60000);

  logger.info(`API is running on port ${port}`);
}

async function startService() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forService(),
    new FastifyAdapter(),
  );
  app.enableShutdownHooks();

  const orm = app.get(MikroORM);
  await app.init();

  setInterval(() => {
    tryDbConnection(orm).catch(() => process.exit(1));
  }, 60000);

  logger.info(`Service is running`);
}

async function bootstrap() {
  if (process.env.FEED_REQUESTS_START_TARGET === 'api') {
    await startApi();
  } else if (process.env.FEED_REQUESTS_START_TARGET === 'service') {
    await startService();
  } else if (process.env.FEED_REQUESTS_START_TARGET) {
    logger.error('Invalid FEED_REQUESTS_START_TARGET environment variable');

    process.exit(1);
  } else {
    await startApi();
    await startService();
  }
}

async function tryDbConnection(orm: MikroORM, currentTries = 0) {
  if (currentTries >= 10) {
    logger.error('Failed to connect to database after 10 tries. Exiting...');

    process.exit(1);
  }

  await orm.em
    .getDriver()
    .getConnection()
    .execute('SELECT 1')
    .catch((err) => {
      logger.error('Failed to ping database', {
        error: (err as Error).stack,
      });

      return tryDbConnection(orm, currentTries + 1);
    });
}

bootstrap();

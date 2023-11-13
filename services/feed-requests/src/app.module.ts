import { DynamicModule, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import config from './config';
import { FeedFetcherModule } from './feed-fetcher/feed-fetcher.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { MikroORM } from '@mikro-orm/core';
import logger from './utils/logger';
import { CacheStorageService } from './cache-storage/cache-storage.service';
import { CacheStorageModule } from './cache-storage/cache-storage.module';

@Module({
  imports: [CacheStorageModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements OnApplicationShutdown {
  static _forCommon(): DynamicModule {
    const configVals = config();
    const replicaUris: string[] = [];

    const replica1 = configVals.FEED_REQUESTS_POSTGRES_REPLICA1_URI;

    if (replica1) {
      replicaUris.push(replica1);
    }

    logger.info(`${replicaUris.length} read replicas discovered`);

    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [config],
        }),
        MikroOrmModule.forRoot({
          entities: ['dist/**/*.entity.js'],
          entitiesTs: ['src/**/*.entity.ts'],
          clientUrl: configVals.FEED_REQUESTS_POSTGRES_URI,
          type: 'postgresql',
          forceUtcTimezone: true,
          timezone: 'UTC',
          // loadStrategy: LoadStrategy.JOINED,
          pool: {
            min: 0,
          },
          preferReadReplicas: replicaUris.length > 0,
          replicas: replicaUris.map((url) => ({
            clientUrl: url,
          })),
        }),
      ],
    };
  }

  static forApi(): DynamicModule {
    const common = this._forCommon();

    return {
      module: AppModule,
      imports: [...(common.imports || []), FeedFetcherModule.forApi()],
    };
  }

  static forService(): DynamicModule {
    const common = this._forCommon();

    return {
      module: AppModule,
      imports: [...(common.imports || []), FeedFetcherModule.forService()],
    };
  }

  static forApiAndService(): DynamicModule {
    const common = this._forCommon();

    return {
      module: AppModule,
      imports: [
        ...(common.imports || []),
        FeedFetcherModule.forApiAndService(),
      ],
    };
  }

  constructor(
    private readonly orm: MikroORM,
    private readonly cacheStorageService: CacheStorageService,
  ) {}

  async onApplicationShutdown(signal?: string | undefined) {
    logger.info(`Received ${signal}. Shutting down db connection...`);

    try {
      await this.orm.close();
      logger.info(`Successfully closed db connection`);
    } catch (err) {
      logger.error('Failed to close database connection', {
        error: (err as Error).stack,
      });
    }

    try {
      await this.cacheStorageService.closeClient();

      logger.info(`Successfully closed redis client`);
    } catch (err) {
      logger.error('Failed to close redis client', {
        error: (err as Error).stack,
      });
    }
  }
}

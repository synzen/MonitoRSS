import { DynamicModule, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import config from './config';
import { FeedFetcherModule } from './feed-fetcher/feed-fetcher.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { LoadStrategy, MikroORM } from '@mikro-orm/core';
import logger from './utils/logger';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements OnApplicationShutdown {
  static _forCommon(): DynamicModule {
    const configVals = config();

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

  constructor(private readonly orm: MikroORM) {}

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
  }
}

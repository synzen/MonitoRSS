import { MikroOrmModule } from "@mikro-orm/nestjs";
import { DynamicModule, Module, OnApplicationShutdown } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AppController } from "./app.controller";
import { config } from "./config";
import { FeedFetcherModule } from "./feed-fetcher/feed-fetcher.module";
import { ArticlesModule } from "./articles/articles.module";
import { FeedEventHandlerModule } from "./feed-event-handler/feed-event-handler.module";
import { ArticleFiltersModule } from "./article-filters/article-filters.module";
import { DeliveryRecordModule } from "./delivery-record/delivery-record.module";
import { ArticleRateLimitModule } from "./article-rate-limit/article-rate-limit.module";
import { FeedsModule } from "./feeds/feeds.module";
import { MikroORM } from "@mikro-orm/core";
import logger from "./shared/utils/logger";
import { CacheStorageModule } from "./cache-storage/cache-storage.module";

@Module({
  imports: [
    FeedFetcherModule,
    ArticlesModule,
    ArticleFiltersModule,
    DeliveryRecordModule,
    ArticleRateLimitModule,
    FeedsModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule implements OnApplicationShutdown {
  static forRoot(): DynamicModule {
    const configVals = config();

    return {
      module: AppModule,
      imports: [
        FeedEventHandlerModule.forRoot(),
        MikroOrmModule.forRootAsync({
          useFactory: (configService: ConfigService) => {
            const replicaUris: string[] = [];

            const replica1 = configService.get<string>(
              "USER_FEEDS_POSTGRES_REPLICA1_URI"
            );

            if (replica1) {
              replicaUris.push(replica1);
            }

            logger.info(`${replicaUris.length} read replicas discovered`);

            return {
              entities: ["dist/**/*.entity.js"],
              entitiesTs: ["src/**/*.entity.ts"],
              clientUrl: configVals.USER_FEEDS_POSTGRES_URI,
              dbName: configVals.USER_FEEDS_POSTGRES_DATABASE,
              type: "postgresql",
              forceUtcTimezone: true,
              timezone: "UTC",
              pool: {
                min: 0,
              },
              preferReadReplicas: replicaUris.length > 0,
              replicas: replicaUris.map((url) => ({
                clientUrl: url,
              })),
            };
          },
          inject: [ConfigService],
        }),
        CacheStorageModule,
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [config],
        }),
      ],
    };
  }

  static forFeedListenerService(): DynamicModule {
    const original = this.forRoot();

    return {
      ...original,
      imports: [
        ...(original.imports || []),
        FeedEventHandlerModule.forFeedListenerService(),
      ],
    };
  }

  constructor(private readonly orm: MikroORM) {}

  async onApplicationShutdown(signal?: string | undefined) {
    logger.info(`Received signal ${signal}. Shutting down db connection...`);

    try {
      await this.orm.close();
      logger.info(`Successfully closed db connection`);
    } catch (err) {
      logger.error("Failed to close database connection", {
        error: (err as Error).stack,
      });
    }
  }
}

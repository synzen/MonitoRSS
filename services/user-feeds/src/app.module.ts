import { MikroOrmModule } from "@mikro-orm/nestjs";
import { DynamicModule, Module, OnApplicationShutdown } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
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
        MikroOrmModule.forRoot({
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
        }),
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
    logger.info(`Received ${signal}. Shutting down db connection...`);

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

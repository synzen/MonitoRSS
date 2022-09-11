import { MikroOrmModule } from "@mikro-orm/nestjs";
import { DynamicModule, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { config } from "./config";
import { FeedFetcherModule } from "./feed-fetcher/feed-fetcher.module";
import { ArticlesModule } from "./articles/articles.module";
import { FeedEventHandlerModule } from "./feed-event-handler/feed-event-handler.module";
import { DeliveryModule } from "./delivery/delivery.module";
import { ArticleFiltersModule } from "./article-filters/article-filters.module";
import { FeedsModule } from "./feeds/feeds.module";
import { MongooseModule } from "@nestjs/mongoose";

@Module({
  imports: [
    FeedFetcherModule,
    ArticlesModule,
    FeedEventHandlerModule,
    DeliveryModule,
    ArticleFiltersModule,
    FeedsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  static forRoot(): DynamicModule {
    const configVals = config();

    return {
      module: AppModule,
      imports: [
        MikroOrmModule.forRoot({
          autoLoadEntities: true,
          clientUrl: configVals.POSTGRES_URI,
          dbName: configVals.POSTGRES_DATABASE,
          type: "postgresql",
          forceUtcTimezone: true,
          timezone: "UTC",
        }),
        MongooseModule.forRoot(configVals.FEED_MONGODB_URI, {
          autoIndex: false,
          retryWrites: true,
          writeConcern: {
            w: "majority",
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
}

import { DynamicModule, Module } from "@nestjs/common";
import { ArticleRateLimitModule } from "../article-rate-limit/article-rate-limit.module";
import { ArticlesModule } from "../articles/articles.module";
import { DeliveryRecordModule } from "../delivery-record/delivery-record.module";
import { DeliveryModule } from "../delivery/delivery.module";
import { FeedFetcherModule } from "../feed-fetcher/feed-fetcher.module";
import { FeedEventHandlerService } from "./feed-event-handler.service";
import { MessageBrokerModule } from "../message-broker/message-broker.module";
import { ResponseHashModule } from "../response-hash/response-hash.module";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import { FeedRetryRecord } from "./entities";
import { CacheStorageModule } from "../cache-storage/cache-storage.module";

@Module({
  controllers: [],
  providers: [],
  imports: [
    ArticlesModule,
    FeedFetcherModule,
    ArticleRateLimitModule,
    DeliveryRecordModule,
    MikroOrmModule.forFeature([FeedRetryRecord]),
  ],
})
export class FeedEventHandlerModule {
  static forRoot(): DynamicModule {
    return {
      module: FeedEventHandlerModule,
    };
  }

  static forFeedListenerService(): DynamicModule {
    return {
      module: FeedEventHandlerModule,
      providers: [FeedEventHandlerService],
      imports: [
        DeliveryModule,
        MessageBrokerModule.forRoot(),
        ResponseHashModule,
        CacheStorageModule,
      ],
    };
  }
}

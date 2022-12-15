import { DynamicModule, Module } from "@nestjs/common";
import { ArticleRateLimitModule } from "../article-rate-limit/article-rate-limit.module";
import { ArticlesModule } from "../articles/articles.module";
import { config } from "../config";
import { DeliveryRecordModule } from "../delivery-record/delivery-record.module";
import { DeliveryModule } from "../delivery/delivery.module";
import { FeedFetcherModule } from "../feed-fetcher/feed-fetcher.module";
import { FeedEventHandlerService } from "./feed-event-handler.service";
import {
  RabbitMQModule,
  MessageHandlerErrorBehavior,
} from "@golevelup/nestjs-rabbitmq";

@Module({
  controllers: [],
  providers: [],
  imports: [
    ArticlesModule,
    FeedFetcherModule,
    ArticleRateLimitModule,
    DeliveryRecordModule,
  ],
})
export class FeedEventHandlerModule {
  static forRoot(): DynamicModule {
    return {
      module: FeedEventHandlerModule,
    };
  }

  static forFeedListenerService(): DynamicModule {
    const configVals = config();

    return {
      module: FeedEventHandlerModule,
      providers: [FeedEventHandlerService],
      imports: [
        DeliveryModule,
        RabbitMQModule.forRoot(RabbitMQModule, {
          uri: configVals.FEED_HANDLER_RABBITMQ_BROKER_URL,
          defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
        }),
      ],
      exports: [RabbitMQModule],
    };
  }
}

import { Module } from "@nestjs/common";
import { FeedsService } from "./feeds.service";
import { FeedsController } from "./feeds.controller";
import { ArticleRateLimitModule } from "../article-rate-limit/article-rate-limit.module";
import { FeedFetcherModule } from "../feed-fetcher/feed-fetcher.module";
import { ArticleFiltersModule } from "../article-filters/article-filters.module";
import { ArticleFormatterModule } from "../article-formatter/article-formatter.module";
import { DeliveryRecordModule } from "../delivery-record/delivery-record.module";
import { ArticlesModule } from "../articles/articles.module";
import { DeliveryModule } from "../delivery/delivery.module";

@Module({
  controllers: [FeedsController],
  providers: [FeedsService],
  imports: [
    ArticleRateLimitModule,
    FeedFetcherModule,
    ArticleFiltersModule,
    ArticleFormatterModule,
    DeliveryRecordModule,
    ArticlesModule,
    DeliveryModule,
  ],
  exports: [],
})
export class FeedsModule {}

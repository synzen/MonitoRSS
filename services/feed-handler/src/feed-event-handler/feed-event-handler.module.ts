import { Module } from "@nestjs/common";
import { ArticleRateLimitModule } from "../article-rate-limit/article-rate-limit.module";
import { ArticlesModule } from "../articles/articles.module";
import { FeedFetcherModule } from "../feed-fetcher/feed-fetcher.module";
import { FeedEventHandlerService } from "./feed-event-handler.service";

@Module({
  controllers: [],
  providers: [FeedEventHandlerService],
  imports: [ArticlesModule, FeedFetcherModule, ArticleRateLimitModule],
})
export class FeedEventHandlerModule {}

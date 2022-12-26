import { Module } from "@nestjs/common";
import { ArticlesModule } from "../articles/articles.module";
import { FeedFetcherService } from "./feed-fetcher.service";

@Module({
  controllers: [],
  providers: [FeedFetcherService],
  exports: [FeedFetcherService],
  imports: [ArticlesModule],
})
export class FeedFetcherModule {}

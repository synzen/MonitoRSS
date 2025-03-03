import { Module } from "@nestjs/common";
import { FeedFetcherService } from "./feed-fetcher.service";

@Module({
  controllers: [],
  providers: [FeedFetcherService],
  exports: [FeedFetcherService],
})
export class FeedFetcherModule {}

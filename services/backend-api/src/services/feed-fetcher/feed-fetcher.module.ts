import { Module } from '@nestjs/common';
import { FeedFetcherService } from './feed-fetcher.service';

@Module({
  providers: [FeedFetcherService],
  exports: [FeedFetcherService],
})
export class FeedFetcherModule {}

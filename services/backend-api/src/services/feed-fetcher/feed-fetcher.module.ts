import { Module } from '@nestjs/common';
import { FeedFetcherService } from './feed-fetcher.service';
import { FeedFetcherApiService } from './feed-fetcher-api.service';
import { join } from 'path';

@Module({
  providers: [FeedFetcherService, FeedFetcherApiService],
  exports: [FeedFetcherService],
  imports: [],
})
export class FeedFetcherModule {}

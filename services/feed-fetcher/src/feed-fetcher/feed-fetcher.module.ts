import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedResponse } from './entities';
import { FeedFetcherService } from './feed-fetcher.service';

@Module({
  providers: [FeedFetcherService],
  exports: [FeedFetcherService],
  imports: [TypeOrmModule.forFeature([FeedResponse])],
})
export class FeedFetcherModule {}

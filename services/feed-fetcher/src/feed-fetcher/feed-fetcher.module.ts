import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestResponse } from './entities';
import { FeedFetcherController } from './feed-fetcher.controller';
import { FeedFetcherService } from './feed-fetcher.service';

@Module({
  controllers: [FeedFetcherController],
  providers: [FeedFetcherService],
  exports: [FeedFetcherService, TypeOrmModule],
  imports: [TypeOrmModule.forFeature([RequestResponse])],
})
export class FeedFetcherModule {}

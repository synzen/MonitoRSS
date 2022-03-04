import { Module } from '@nestjs/common';
import { FeedsService } from './feeds.service';
import { FeedsController } from './feeds.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { FeedFeature } from './entities/Feed.entity';
import { DiscordAuthModule } from '../discord-auth/discord-auth.module';
import { FeedFetcherModule } from '../../services/feed-fetcher/feed-fetcher.module';
import { FailRecordFeature } from './entities/fail-record.entity';

@Module({
  controllers: [FeedsController],
  providers: [FeedsService],
  imports: [
    DiscordAuthModule,
    MongooseModule.forFeature([FeedFeature, FailRecordFeature]),
    FeedFetcherModule,
  ],
  exports: [FeedsService, MongooseModule.forFeature([FeedFeature])],
})
export class FeedsModule {}

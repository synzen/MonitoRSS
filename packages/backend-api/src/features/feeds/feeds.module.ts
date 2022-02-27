import { Module } from '@nestjs/common';
import { FeedsService } from './feeds.service';
import { FeedsController } from './feeds.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { FeedFeature } from './entities/Feed.entity';
import { DiscordUserModule } from '../discord-users/discord-users.module';
import { DiscordAuthModule } from '../discord-auth/discord-auth.module';
import { FeedFetcherModule } from '../../services/feed-fetcher/feed-fetcher.module';

@Module({
  controllers: [FeedsController],
  providers: [FeedsService],
  imports: [
    DiscordUserModule,
    DiscordAuthModule,
    MongooseModule.forFeature([FeedFeature]),
    FeedFetcherModule,
  ],
})
export class FeedsModule {}

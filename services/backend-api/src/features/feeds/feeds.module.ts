/* eslint-disable max-len */
import { Module } from "@nestjs/common";
import { FeedsService } from "./feeds.service";
import { FeedsController } from "./feeds.controller";
import { MongooseModule } from "@nestjs/mongoose";
import { FeedFeature } from "./entities/feed.entity";
import { DiscordAuthModule } from "../discord-auth/discord-auth.module";
import { FeedFetcherModule } from "../../services/feed-fetcher/feed-fetcher.module";
import { FailRecordFeature } from "./entities/fail-record.entity";
import { SupportersModule } from "../supporters/supporters.module";
import { DiscordWebhooksModule } from "../discord-webhooks/discord-webhooks.module";
import { FeedScheduleFeature } from "./entities/feed-schedule.entity";
import { FeedSchedulingService } from "./feed-scheduling.service";
import { FeedSubscriberFeature } from "./entities/feed-subscriber.entity";
import { FeedSubscribersController } from "./feed-subscribers.controller";
import { FeedSubscribersService } from "./feed-subscribers.service";
import { DiscordApiModule } from "../../services/apis/discord/discord-api.module";
import { BannedFeedFeature } from "./entities/banned-feed.entity";
import { FeedFilteredFormatFeature } from "./entities/feed-filtered-format.entity";
import { UserFeedFeature } from "../user-feeds/entities";
import { LegacyFeedConversionModule } from "../legacy-feed-conversion/legacy-feed-conversion.module";
import { CacheModule } from "@nestjs/cache-manager";

@Module({
  controllers: [FeedsController, FeedSubscribersController],
  providers: [FeedsService, FeedSubscribersService, FeedSchedulingService],
  imports: [
    CacheModule.register(),
    DiscordAuthModule,
    MongooseModule.forFeature([
      FeedFeature,
      FailRecordFeature,
      FeedScheduleFeature,
      FeedSubscriberFeature,
      BannedFeedFeature,
      FeedFilteredFormatFeature,
      UserFeedFeature,
    ]),
    FeedFetcherModule,
    SupportersModule,
    DiscordWebhooksModule,
    DiscordApiModule,
    LegacyFeedConversionModule,
  ],
  exports: [
    FeedsService,
    FeedSchedulingService,
    MongooseModule.forFeature([FeedFeature]),
  ],
})
export class FeedsModule {}

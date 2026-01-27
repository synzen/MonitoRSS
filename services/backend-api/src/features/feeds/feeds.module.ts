import { Module } from "@nestjs/common";
import { FeedsService } from "./feeds.service";
import { MongooseModule } from "@nestjs/mongoose";
import { FeedFeature } from "./entities/feed.entity";
import { DiscordAuthModule } from "../discord-auth/discord-auth.module";
import { FailRecordFeature } from "./entities/fail-record.entity";
import { FeedScheduleFeature } from "./entities/feed-schedule.entity";
import { FeedSchedulingService } from "./feed-scheduling.service";
import { DiscordApiModule } from "../../services/apis/discord/discord-api.module";
import { BannedFeedFeature } from "./entities/banned-feed.entity";
import { CacheModule } from "@nestjs/cache-manager";
import { SupportersModule } from "../supporters/supporters.module";

@Module({
  controllers: [],
  providers: [FeedsService, FeedSchedulingService],
  imports: [
    CacheModule.register(),
    DiscordAuthModule,
    MongooseModule.forFeature([
      FeedFeature,
      FailRecordFeature,
      FeedScheduleFeature,
      BannedFeedFeature,
    ]),
    SupportersModule,
    DiscordApiModule,
  ],
  exports: [
    FeedsService,
    FeedSchedulingService,
    MongooseModule.forFeature([FeedFeature]),
  ],
})
export class FeedsModule {}

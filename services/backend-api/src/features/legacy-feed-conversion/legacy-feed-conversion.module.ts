import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { DiscordApiModule } from "../../services/apis/discord/discord-api.module";
import { DiscordServerProfileFeature } from "../discord-servers/entities";
import { FailRecordFeature } from "../feeds/entities/fail-record.entity";
import { FeedFilteredFormatFeature } from "../feeds/entities/feed-filtered-format.entity";
import { FeedSubscriberFeature } from "../feeds/entities/feed-subscriber.entity";
import { FeedFeature } from "../feeds/entities/feed.entity";
import { UserFeedFeature } from "../user-feeds/entities";
import { LegacyFeedConversionService } from "./legacy-feed-conversion.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      FeedFeature,
      UserFeedFeature,
      FeedSubscriberFeature,
      DiscordServerProfileFeature,
      FeedFilteredFormatFeature,
      FailRecordFeature,
    ]),
    DiscordApiModule,
  ],
  controllers: [],
  providers: [LegacyFeedConversionService],
  exports: [LegacyFeedConversionService],
})
export class LegacyFeedConversionModule {}

/* eslint-disable max-len */
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { DiscordApiModule } from "../../services/apis/discord/discord-api.module";
import { DiscordAuthModule } from "../discord-auth/discord-auth.module";
import { FeedFilteredFormatFeature } from "../feeds/entities/feed-filtered-format.entity";
import { FeedSubscriberFeature } from "../feeds/entities/feed-subscriber.entity";
import { FeedFeature } from "../feeds/entities/feed.entity";
import { FeedsModule } from "../feeds/feeds.module";
import { LegacyFeedConversionModule } from "../legacy-feed-conversion/legacy-feed-conversion.module";
import { DiscordServersController } from "./discord-servers.controller";
import { DiscordServersService } from "./discord-servers.service";
import { DiscordServerProfileFeature } from "./entities/discord-server-profile.entity";
import { CacheModule } from "@nestjs/cache-manager";

@Module({
  imports: [
    CacheModule.register(),
    DiscordApiModule,
    DiscordAuthModule,
    FeedsModule,
    LegacyFeedConversionModule,
    MongooseModule.forFeature([
      DiscordServerProfileFeature,
      FeedFeature,
      FeedSubscriberFeature,
      FeedFilteredFormatFeature,
    ]),
  ],
  controllers: [DiscordServersController],
  providers: [DiscordServersService],
  exports: [
    DiscordServersService,
    MongooseModule.forFeature([DiscordServerProfileFeature]),
  ],
})
export class DiscordServersModule {}

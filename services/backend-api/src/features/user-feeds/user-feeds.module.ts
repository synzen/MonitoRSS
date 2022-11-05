import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { DiscordAuthModule } from "../discord-auth/discord-auth.module";
import { FeedFetcherModule } from "../../services/feed-fetcher/feed-fetcher.module";
import { SupportersModule } from "../supporters/supporters.module";
import { DiscordWebhooksModule } from "../discord-webhooks/discord-webhooks.module";
import { DiscordApiModule } from "../../services/apis/discord/discord-api.module";
import { UserFeedFeature } from "./entities";
import { UserFeedsService } from "./user-feeds.service";

@Module({
  controllers: [],
  providers: [UserFeedsService],
  imports: [
    DiscordAuthModule,
    MongooseModule.forFeature([UserFeedFeature]),
    FeedFetcherModule,
    SupportersModule,
    DiscordWebhooksModule,
    DiscordApiModule,
  ],
  exports: [MongooseModule.forFeature([UserFeedFeature])],
})
export class UserFeedsModule {}

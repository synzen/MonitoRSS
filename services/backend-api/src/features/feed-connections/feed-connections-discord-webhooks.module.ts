/* eslint-disable max-len */
import { Module } from "@nestjs/common";
import { DiscordAuthModule } from "../discord-auth/discord-auth.module";
import { DiscordWebhooksModule } from "../discord-webhooks/discord-webhooks.module";
import { FeedsModule } from "../feeds/feeds.module";
import { FeedConnectionsDiscordWebhooksService } from "./feed-connections-discord-webhooks.service";
import { FeedConnectionsDiscordWebhooksController } from "./feed-connections-discord-webhooks.controller";
import { UserFeedsModule } from "../user-feeds/user-feeds.module";

@Module({
  controllers: [FeedConnectionsDiscordWebhooksController],
  providers: [FeedConnectionsDiscordWebhooksService],
  imports: [
    UserFeedsModule,
    FeedsModule,
    DiscordWebhooksModule,
    DiscordAuthModule,
  ],
})
export class FeedConnectionsDiscordWebhooksModule {}

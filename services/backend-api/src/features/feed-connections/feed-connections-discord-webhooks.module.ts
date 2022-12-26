/* eslint-disable max-len */
import { Module } from "@nestjs/common";
import { DiscordAuthModule } from "../discord-auth/discord-auth.module";
import { DiscordWebhooksModule } from "../discord-webhooks/discord-webhooks.module";
import { FeedsModule } from "../feeds/feeds.module";
import { FeedConnectionsDiscordWebhooksService } from "./feed-connections-discord-webhooks.service";
import { FeedConnectionsDiscordWebhooksController } from "./feed-connections-discord-webhooks.controller";
import { UserFeedsModule } from "../user-feeds/user-feeds.module";
import { FeedHandlerModule } from "../../services/feed-handler/feed-fetcher.module";

@Module({
  controllers: [FeedConnectionsDiscordWebhooksController],
  providers: [FeedConnectionsDiscordWebhooksService],
  imports: [
    UserFeedsModule,
    FeedsModule,
    DiscordWebhooksModule,
    DiscordAuthModule,
    FeedHandlerModule,
  ],
})
export class FeedConnectionsDiscordWebhooksModule {}

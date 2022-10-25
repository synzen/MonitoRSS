import { Module } from "@nestjs/common";
import { DiscordAuthModule } from "../discord-auth/discord-auth.module";
import { DiscordWebhooksModule } from "../discord-webhooks/discord-webhooks.module";
import { FeedsModule } from "../feeds/feeds.module";
import { FeedConnectionsService } from "./feed-connections.service";
import { FeedsConnectionsController } from "./feeds-connections.controller";

@Module({
  controllers: [FeedsConnectionsController],
  providers: [FeedConnectionsService],
  imports: [FeedsModule, DiscordWebhooksModule, DiscordAuthModule],
})
export class FeedConnectionsModule {}

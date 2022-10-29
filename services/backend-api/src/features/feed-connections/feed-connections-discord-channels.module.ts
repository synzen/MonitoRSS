/* eslint-disable max-len */
import { Module } from "@nestjs/common";
import { DiscordAuthModule } from "../discord-auth/discord-auth.module";
import { FeedsModule } from "../feeds/feeds.module";
import { FeedConnectionsDiscordChannelsService } from "./feed-connections-discord-channels.service";
import { FeedConnectionsDiscordChannelsController } from "./feed-connections-discord-channels.controller";

@Module({
  controllers: [FeedConnectionsDiscordChannelsController],
  providers: [FeedConnectionsDiscordChannelsService],
  imports: [FeedsModule, DiscordAuthModule],
})
export class FeedConnectionsDiscordChannelsModule {}

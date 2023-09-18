/* eslint-disable max-len */
import { DynamicModule, Module } from "@nestjs/common";
import { DiscordAuthModule } from "../discord-auth/discord-auth.module";
import { FeedsModule } from "../feeds/feeds.module";
import { FeedConnectionsDiscordChannelsService } from "./feed-connections-discord-channels.service";
import { FeedConnectionsDiscordChannelsController } from "./feed-connections-discord-channels.controller";
import { UserFeedsModule } from "../user-feeds/user-feeds.module";
import { FeedHandlerModule } from "../../services/feed-handler/feed-fetcher.module";
import { SupportersModule } from "../supporters/supporters.module";

@Module({
  controllers: [FeedConnectionsDiscordChannelsController],
  providers: [FeedConnectionsDiscordChannelsService],
  imports: [
    FeedsModule,
    DiscordAuthModule,
    FeedHandlerModule,
    SupportersModule,
  ],
})
export class FeedConnectionsDiscordChannelsModule {
  static forRoot(): DynamicModule {
    return {
      module: FeedConnectionsDiscordChannelsModule,
      imports: [UserFeedsModule.forRoot()],
    };
  }
}

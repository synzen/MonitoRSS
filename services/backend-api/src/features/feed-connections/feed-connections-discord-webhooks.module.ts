/* eslint-disable max-len */
import { DynamicModule, Module } from "@nestjs/common";
import { DiscordAuthModule } from "../discord-auth/discord-auth.module";
import { DiscordWebhooksModule } from "../discord-webhooks/discord-webhooks.module";
import { FeedsModule } from "../feeds/feeds.module";
import { FeedConnectionsDiscordWebhooksService } from "./feed-connections-discord-webhooks.service";
import { UserFeedsModule } from "../user-feeds/user-feeds.module";
import { FeedHandlerModule } from "../../services/feed-handler/feed-fetcher.module";
import { DiscordApiModule } from "../../services/apis/discord/discord-api.module";
import { SupportersModule } from "../supporters/supporters.module";

@Module({
  controllers: [],
  providers: [FeedConnectionsDiscordWebhooksService],
  imports: [
    FeedsModule,
    DiscordWebhooksModule,
    DiscordAuthModule,
    FeedHandlerModule,
    DiscordApiModule,
    SupportersModule,
  ],
})
export class FeedConnectionsDiscordWebhooksModule {
  static forRoot(): DynamicModule {
    return {
      module: FeedConnectionsDiscordWebhooksModule,
      imports: [UserFeedsModule.forRoot()],
    };
  }
}

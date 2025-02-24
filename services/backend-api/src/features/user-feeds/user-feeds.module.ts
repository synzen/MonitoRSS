/* eslint-disable max-len */
import { DynamicModule, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { DiscordAuthModule } from "../discord-auth/discord-auth.module";
import { FeedFetcherModule } from "../../services/feed-fetcher/feed-fetcher.module";
import { SupportersModule } from "../supporters/supporters.module";
import { DiscordWebhooksModule } from "../discord-webhooks/discord-webhooks.module";
import { DiscordApiModule } from "../../services/apis/discord/discord-api.module";
import { UserFeedFeature } from "./entities";
import { UserFeedsService } from "./user-feeds.service";
import { FeedsModule } from "../feeds/feeds.module";
import { UserFeedsController } from "./user-feeds.controller";
import { FeedHandlerModule } from "../../services/feed-handler/feed-fetcher.module";
import { MessageBrokerModule } from "../message-broker/message-broker.module";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { FeedFeature } from "../feeds/entities/feed.entity";
import { UserFeedLimitOverrideFeature } from "../supporters/entities/user-feed-limit-overrides.entity";
import { LegacyFeedConversionJobFeature } from "../legacy-feed-conversion/entities/legacy-feed-conversion-job.entity";
import { FeedConnectionsDiscordChannelsModule } from "../feed-connections/feed-connections-discord-channels.module";
import { UserFeature } from "../users/entities/user.entity";
import { UsersModule } from "../users/users.module";

@Module({
  controllers: [UserFeedsController],
  providers: [UserFeedsService],
  imports: [
    DiscordAuthModule,
    MongooseModule.forFeature([
      UserFeedFeature,
      FeedFeature,
      UserFeedLimitOverrideFeature,
      LegacyFeedConversionJobFeature,
      UserFeature,
    ]),
    FeedFetcherModule,
    SupportersModule,
    DiscordWebhooksModule,
    DiscordApiModule,
    FeedsModule,
    SupportersModule,
    FeedHandlerModule,
    UsersModule,
    MessageBrokerModule.forRoot(),
    FeedConnectionsDiscordChannelsModule,
  ],
  exports: [UserFeedsService, MongooseModule.forFeature([UserFeedFeature])],
})
export class UserFeedsModule {
  static forTest(): DynamicModule {
    return {
      module: UserFeedsModule,
      providers: [
        {
          provide: AmqpConnection,
          useValue: {
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            publish: async () => {},
          },
        },
      ],
    };
  }
}

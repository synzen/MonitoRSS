import { CacheModule, DynamicModule, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { DiscordAuthModule } from "../discord-auth/discord-auth.module";
import { MessageBrokerModule } from "../message-broker/message-broker.module";
import { PaddleModule } from "../paddle/paddle.module";
import { SupportersModule } from "../supporters/supporters.module";
import { UserFeedsModule } from "../user-feeds/user-feeds.module";
import { UserFeature } from "../users/entities/user.entity";
import { PaddleWebhooksService } from "./paddle-webhooks.service";
import { SupporterSubscriptionsController } from "./supporter-subscriptions.controller";
import { SupporterSubscriptionsService } from "./supporter-subscriptions.service";

@Module({
  controllers: [SupporterSubscriptionsController],
  providers: [SupporterSubscriptionsService, PaddleWebhooksService],
  imports: [
    CacheModule.register({}),
    DiscordAuthModule,
    MongooseModule.forFeature([UserFeature]),
    SupportersModule,
    PaddleModule,
  ],
  exports: [SupporterSubscriptionsService],
})
export class SupporterSubscriptionsModule {
  static forRoot(): DynamicModule {
    return {
      module: SupporterSubscriptionsModule,
      imports: [MessageBrokerModule.forRoot(), UserFeedsModule.forRoot()],
    };
  }
}

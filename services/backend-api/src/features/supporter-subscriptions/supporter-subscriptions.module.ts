import { CacheModule, Module } from "@nestjs/common";
import { DiscordAuthModule } from "../discord-auth/discord-auth.module";
import { SupportersModule } from "../supporters/supporters.module";
import { UsersModule } from "../users/users.module";
import { PaddleWebhooksService } from "./paddle-webhooks.service";
import { SupporterSubscriptionsController } from "./supporter-subscriptions.controller";
import { SupporterSubscriptionsService } from "./supporter-subscriptions.service";

@Module({
  controllers: [SupporterSubscriptionsController],
  providers: [SupporterSubscriptionsService, PaddleWebhooksService],
  imports: [
    CacheModule.register({}),
    DiscordAuthModule,
    UsersModule.forRoot(),
    SupportersModule,
  ],
  exports: [],
})
export class SupporterSubscriptionsModule {}

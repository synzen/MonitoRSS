import { CacheModule, Module } from "@nestjs/common";
import { DiscordAuthModule } from "../discord-auth/discord-auth.module";
import { SupporterSubscriptionsController } from "./supporter-subscriptions.controller";
import { SupporterSubscriptionsService } from "./supporter-subscriptions.service";

@Module({
  controllers: [SupporterSubscriptionsController],
  providers: [SupporterSubscriptionsService],
  imports: [CacheModule.register({}), DiscordAuthModule],
  exports: [],
})
export class SupporterSubscriptionsModule {}

import { Module } from "@nestjs/common";
import { DiscordApiModule } from "../../services/apis/discord/discord-api.module";
import { DiscordAuthModule } from "../discord-auth/discord-auth.module";
import { DiscordWebhooksController } from "./discord-webhooks.controller";
import { DiscordWebhooksService } from "./discord-webhooks.service";
import { CacheModule } from "@nestjs/cache-manager";

@Module({
  providers: [DiscordWebhooksService],
  controllers: [DiscordWebhooksController],
  imports: [CacheModule.register(), DiscordApiModule, DiscordAuthModule],
  exports: [DiscordWebhooksService],
})
export class DiscordWebhooksModule {}

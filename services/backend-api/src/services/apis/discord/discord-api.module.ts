import { Module } from "@nestjs/common";
import { DiscordAPIService } from "./discord-api.service";

@Module({
  providers: [DiscordAPIService],
  exports: [DiscordAPIService],
})
export class DiscordApiModule {}

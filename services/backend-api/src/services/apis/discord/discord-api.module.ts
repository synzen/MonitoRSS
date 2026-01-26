import { Module } from "@nestjs/common";
import { DiscordAPIService } from "./discord-api.service";
import { DISCORD_REST_STRATEGY, DiscordjsRestStrategy } from "./strategies";

@Module({
  providers: [
    DiscordAPIService,
    {
      provide: DISCORD_REST_STRATEGY,
      useClass: DiscordjsRestStrategy,
    },
  ],
  exports: [DiscordAPIService],
})
export class DiscordApiModule {}

import { Module } from "@nestjs/common";
import { DiscordApiModule } from "../../services/apis/discord/discord-api.module";
import { FeedsModule } from "../feeds/feeds.module";

@Module({
  controllers: [],
  providers: [],
  imports: [FeedsModule, DiscordApiModule],
})
export class FeedConnectionsModule {}

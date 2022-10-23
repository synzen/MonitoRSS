import { Module } from "@nestjs/common";
import { DiscordApiModule } from "../../services/apis/discord/discord-api.module";
import { DiscordAuthModule } from "../discord-auth/discord-auth.module";
import { FeedsModule } from "../feeds/feeds.module";
import { FeedConnectionsService } from "./feed-connections.service";
import { FeedsConnectionsController } from "./feeds-connections.controller";

@Module({
  controllers: [FeedsConnectionsController],
  providers: [FeedConnectionsService],
  imports: [FeedsModule, DiscordApiModule, DiscordAuthModule],
})
export class FeedConnectionsModule {}

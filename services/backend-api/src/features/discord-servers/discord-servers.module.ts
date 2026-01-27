/* eslint-disable max-len */
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { DiscordApiModule } from "../../services/apis/discord/discord-api.module";
import { DiscordAuthModule } from "../discord-auth/discord-auth.module";
import { FeedsModule } from "../feeds/feeds.module";
import { DiscordServersController } from "./discord-servers.controller";
import { DiscordServersService } from "./discord-servers.service";
import { DiscordServerProfileFeature } from "./entities/discord-server-profile.entity";
import { CacheModule } from "@nestjs/cache-manager";

@Module({
  imports: [
    CacheModule.register(),
    DiscordApiModule,
    DiscordAuthModule,
    FeedsModule,
    MongooseModule.forFeature([DiscordServerProfileFeature]),
  ],
  controllers: [DiscordServersController],
  providers: [DiscordServersService],
  exports: [
    DiscordServersService,
    MongooseModule.forFeature([DiscordServerProfileFeature]),
  ],
})
export class DiscordServersModule {}

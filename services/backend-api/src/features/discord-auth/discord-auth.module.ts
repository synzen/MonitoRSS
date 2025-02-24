import { Module } from "@nestjs/common";
import { DiscordApiModule } from "../../services/apis/discord/discord-api.module";
import { UsersModule } from "../users/users.module";
import { DiscordAuthController } from "./discord-auth.controller";
import { DiscordAuthService } from "./discord-auth.service";
import { DiscordPermissionsService } from "./discord-permissions.service";

@Module({
  imports: [DiscordApiModule, UsersModule],
  controllers: [DiscordAuthController],
  providers: [DiscordAuthService, DiscordPermissionsService],
  exports: [DiscordAuthService, DiscordPermissionsService],
})
export class DiscordAuthModule {}

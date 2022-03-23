import { Module } from '@nestjs/common';
import { DiscordApiModule } from '../../services/apis/discord/discord-api.module';
import { DiscordAuthController } from './discord-auth.controller';
import { DiscordAuthService } from './discord-auth.service';
import { DiscordPermissionsService } from './discord-permissions.service';

@Module({
  imports: [DiscordApiModule],
  controllers: [DiscordAuthController],
  providers: [DiscordAuthService, DiscordPermissionsService],
  exports: [DiscordAuthService],
})
export class DiscordAuthModule {}

import { Module } from '@nestjs/common';
import { DiscordAuthController } from './discord-auth.controller';
import DiscordAuthService from './discord-auth.service';

@Module({
  imports: [],
  controllers: [DiscordAuthController],
  providers: [DiscordAuthService],
  exports: [DiscordAuthService],
})
export class DiscordAuthModule {}

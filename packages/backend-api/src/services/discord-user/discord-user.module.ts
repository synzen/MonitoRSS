import { Module } from '@nestjs/common';
import { DiscordUserService } from './discord-user.service';

@Module({
  imports: [],
  controllers: [],
  providers: [DiscordUserService],
  exports: [DiscordUserService],
})
export class DiscordUserModule {}

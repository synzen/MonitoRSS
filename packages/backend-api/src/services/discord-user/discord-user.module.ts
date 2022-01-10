import { Module } from '@nestjs/common';
import { DiscordApiModule } from '../apis/discord/discord-api.module';
import { DiscordUserService } from './discord-user.service';

@Module({
  imports: [DiscordApiModule],
  controllers: [],
  providers: [DiscordUserService],
  exports: [DiscordUserService],
})
export class DiscordUserModule {}

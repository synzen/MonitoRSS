import { Module } from '@nestjs/common';
import { DiscordApiModule } from '../services/apis/discord/discord-api.module';
import { DiscordUsersService } from './discord-users.service';

@Module({
  imports: [DiscordApiModule],
  controllers: [],
  providers: [DiscordUsersService],
  exports: [DiscordUsersService],
})
export class DiscordUserModule {}

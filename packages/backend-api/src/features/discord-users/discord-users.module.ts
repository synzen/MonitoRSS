import { Module } from '@nestjs/common';
import { DiscordAuthModule } from 'src/features/discord-auth/discord-auth.module';
import { DiscordApiModule } from '../../services/apis/discord/discord-api.module';
import { DiscordUsersController } from './discord-users.controller';
import { DiscordUsersService } from './discord-users.service';

@Module({
  imports: [DiscordApiModule, DiscordAuthModule],
  controllers: [DiscordUsersController],
  providers: [DiscordUsersService],
  exports: [DiscordUsersService],
})
export class DiscordUserModule {}

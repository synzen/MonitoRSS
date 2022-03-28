import { Module } from '@nestjs/common';
import { DiscordAuthModule } from '../../features/discord-auth/discord-auth.module';
import { DiscordApiModule } from '../../services/apis/discord/discord-api.module';
import { SupportersModule } from '../supporters/supporters.module';
import { DiscordUsersController } from './discord-users.controller';
import { DiscordUsersService } from './discord-users.service';

@Module({
  imports: [DiscordApiModule, DiscordAuthModule, SupportersModule],
  controllers: [DiscordUsersController],
  providers: [DiscordUsersService],
  exports: [DiscordUsersService],
})
export class DiscordUserModule {}

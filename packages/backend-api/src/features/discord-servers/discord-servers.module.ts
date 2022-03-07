import { CacheModule, Module } from '@nestjs/common';
import { DiscordApiModule } from '../../services/apis/discord/discord-api.module';
import { DiscordAuthModule } from '../discord-auth/discord-auth.module';
import { FeedsModule } from '../feeds/feeds.module';
import { DiscordServersController } from './discord-servers.controller';
import { DiscordServersService } from './discord-servers.service';

@Module({
  imports: [
    CacheModule.register(),
    DiscordApiModule,
    DiscordAuthModule,
    FeedsModule,
  ],
  controllers: [DiscordServersController],
  providers: [DiscordServersService],
  exports: [DiscordServersService],
})
export class DiscordServersModule {}

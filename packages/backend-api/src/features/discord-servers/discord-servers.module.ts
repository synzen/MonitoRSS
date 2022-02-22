import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DiscordApiModule } from '../../services/apis/discord/discord-api.module';
import { DiscordUserModule } from '../discord-users/discord-users.module';
import { FailRecordFeature } from '../feeds/entities/fail-record.entity';
import { FeedFeature } from '../feeds/entities/Feed.entity';
import { DiscordServersController } from './discord-servers.controller';
import { DiscordServersService } from './discord-servers.service';

@Module({
  imports: [
    MongooseModule.forFeature([FeedFeature, FailRecordFeature]),
    DiscordApiModule,
    DiscordUserModule,
  ],
  controllers: [DiscordServersController],
  providers: [DiscordServersService],
  exports: [DiscordServersService],
})
export class DiscordServersModule {}

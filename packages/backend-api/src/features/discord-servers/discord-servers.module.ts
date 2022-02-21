import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FailRecordFeature } from '../feeds/entities/fail-record.entity';
import { FeedFeature } from '../feeds/entities/Feed.entity';
import { DiscordServersController } from './discord-servers.controller';
import { DiscordServersService } from './discord-servers.service';

@Module({
  imports: [MongooseModule.forFeature([FeedFeature, FailRecordFeature])],
  controllers: [DiscordServersController],
  providers: [DiscordServersService],
  exports: [DiscordServersService],
})
export class DiscordServersModule {}

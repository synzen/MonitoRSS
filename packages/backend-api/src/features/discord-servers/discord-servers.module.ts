import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FeedFeature } from '../feeds/entities/Feed.entity';

@Module({
  imports: [MongooseModule.forFeature([FeedFeature])],
  controllers: [],
  providers: [],
  exports: [],
})
export class DiscordServersModule {}

import { Module } from '@nestjs/common';
import { FeedsService } from './feeds.service';
import { FeedsController } from './feeds.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { FeedFeature } from './entities/Feed.entity';

@Module({
  controllers: [FeedsController],
  providers: [FeedsService],
  imports: [MongooseModule.forFeature([FeedFeature])],
})
export class FeedsModule {}

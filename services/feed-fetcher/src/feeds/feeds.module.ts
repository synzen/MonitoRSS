import { Module } from '@nestjs/common';
import { FeedsService } from './feeds.service';
import { MongooseModule } from '@nestjs/mongoose';
import { FeedFeature } from './schemas/feed.schema';

@Module({
  providers: [FeedsService],
  imports: [MongooseModule.forFeature([FeedFeature])],
  exports: [FeedsService],
})
export class FeedsModule {}

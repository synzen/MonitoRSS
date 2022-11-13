import { Module } from '@nestjs/common';
import { FeedsService } from './feeds.service';
import { MongooseModule } from '@nestjs/mongoose';
import { UserFeedFeature } from './schemas/user-feed.schema';

@Module({
  providers: [FeedsService],
  imports: [MongooseModule.forFeature([UserFeedFeature])],
  exports: [FeedsService],
})
export class FeedsModule {}

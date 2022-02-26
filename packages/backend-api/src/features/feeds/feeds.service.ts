import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Feed, FeedModel } from './entities/Feed.entity';
import { FeedWithRefreshRate } from './types/FeedWithRefreshRate';

@Injectable()
export class FeedsService {
  constructor(@InjectModel(Feed.name) private readonly feedModel: FeedModel) {}

  async getFeed(feedId: string): Promise<FeedWithRefreshRate | null> {
    const feed: Feed = await this.feedModel.findById(feedId).lean();

    if (!feed) {
      return null;
    }

    return {
      ...feed,
      refreshRateSeconds: 10,
    };
  }
}

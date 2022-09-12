import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Feed, FeedDocument } from './schemas/feed.schema';

@Injectable()
export class FeedsService {
  constructor(@InjectModel(Feed.name) private feedModel: Model<FeedDocument>) {}

  async disableFeedsByUrl(url: string): Promise<void> {
    await this.feedModel.updateMany(
      { url },
      {
        disabled:
          'Failed to establish a successful connection for an extended duration of time',
        disabledCode: 'FAILED_CONNECTION',
      },
    );
  }

  async enableFailedFeedsByUrl(url: string) {
    await this.feedModel.updateMany(
      { url, disabledCode: 'FAILED_CONNECTION' },
      {
        $unset: {
          disabled: '',
          disabledCode: '',
        },
      },
    );
  }
}

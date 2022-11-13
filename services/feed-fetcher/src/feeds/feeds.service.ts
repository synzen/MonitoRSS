import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  UserFeed,
  UserFeedDisabledCode,
  UserFeedDocument,
} from './schemas/user-feed.schema';

@Injectable()
export class FeedsService {
  constructor(
    @InjectModel(UserFeed.name) private userFeedModel: Model<UserFeedDocument>,
  ) {}

  async disableFeedsByUrl(url: string): Promise<void> {
    await this.userFeedModel.updateMany(
      { url },
      {
        disabledCode: UserFeedDisabledCode.FailedRequests,
      },
    );
  }

  async enableFailedFeedsByUrl(url: string) {
    await this.userFeedModel.updateMany(
      { url, disabledCode: UserFeedDisabledCode.FailedRequests },
      {
        $unset: {
          disabledCode: '',
        },
      },
    );
  }
}

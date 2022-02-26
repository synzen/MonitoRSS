import {
  PipeTransform,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { FeedsService } from '../feeds.service';
import { FeedWithRefreshRate } from '../types/FeedWithRefreshRate';
import { Types } from 'mongoose';

@Injectable()
export class GetFeedPipe implements PipeTransform {
  constructor(private readonly feedService: FeedsService) {}

  async transform(feedId: string): Promise<FeedWithRefreshRate> {
    if (!Types.ObjectId.isValid(feedId)) {
      throw new BadRequestException(`Invalid feed ID: ${feedId}`);
    }

    const feed = await this.feedService.getFeed(feedId);

    if (!feed) {
      throw new NotFoundException(`Feed ${feedId} does not exist`);
    }

    return feed;
  }
}

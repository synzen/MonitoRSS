import { PipeTransform, Injectable, NotFoundException } from '@nestjs/common';
import { FeedSubscribersService } from '../feed-subscribers.service';
import { FeedSubscriber } from '../entities/feed-subscriber.entity';

@Injectable()
export class GetFeedSubscriberPipe implements PipeTransform {
  constructor(
    private readonly feedSubscribersService: FeedSubscribersService,
  ) {}

  async transform({
    feedId,
    subscriberId,
  }: {
    feedId: string;
    subscriberId: string;
  }): Promise<FeedSubscriber> {
    const found = await this.feedSubscribersService.findByIdAndFeed({
      feedId,
      subscriberId,
    });

    if (!found) {
      throw new NotFoundException(`Subscriber does not exist`);
    }

    return found;
  }
}

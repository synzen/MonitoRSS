import {
  FeedSubscriber,
  FeedSubscriberType,
} from '../entities/feed-subscriber.entity';
import { GetFeedOutputDto } from './GetFeedOutput.dto';

interface FeedSubscribersOutputDto {
  id: string;
  discordId: string;
  filters: Array<{ category: string; value: string }>;
  type: FeedSubscriberType;
  feed: string;
}

export class GetFeedSubscribersOutputDto {
  results: FeedSubscribersOutputDto[];
  total: number;

  static fromEntity(
    subscribers: FeedSubscriber[],
  ): GetFeedSubscribersOutputDto {
    const resultSoFar: GetFeedSubscribersOutputDto = {
      results: subscribers.map((subscriber) => ({
        id: subscriber._id.toHexString(),
        type: subscriber.type,
        discordId: subscriber.id,
        filters: GetFeedOutputDto.getFeedFiltersDto(subscriber.filters),
        feed: subscriber.feed.toHexString(),
      })),
      total: subscribers.length,
    };

    return resultSoFar;
  }
}

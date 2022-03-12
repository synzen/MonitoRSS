import {
  FeedSubscriber,
  FeedSubscriberType,
} from '../entities/feed-subscriber.entity';
import { GetFeedOutputDto } from './GetFeedOutput.dto';

interface CreateFeedSubscriberDto {
  type: FeedSubscriberType;
  id: string;
  filters: Array<{ category: string; value: string }>;
  feed: string;
}

export class CreateFeedSubscriberOutputDto {
  result: CreateFeedSubscriberDto;

  static fromEntity(entity: FeedSubscriber): CreateFeedSubscriberOutputDto {
    return {
      result: {
        feed: entity.feed.toHexString(),
        type: entity.type,
        filters: GetFeedOutputDto.getFeedFiltersDto(entity.filters),
        id: entity.id,
      },
    };
  }
}

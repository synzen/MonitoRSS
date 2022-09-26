import {
  FeedSubscriber,
  FeedSubscriberType,
} from "../entities/feed-subscriber.entity";
import { GetFeedOutputDto } from "./GetFeedOutput.dto";

interface CreateFeedSubscriberDto {
  id: string;
  discordId: string;
  filters: Array<{ category: string; value: string }>;
  type: FeedSubscriberType;
  feed: string;
}

export class CreateFeedSubscriberOutputDto {
  result: CreateFeedSubscriberDto;

  static fromEntity(entity: FeedSubscriber): CreateFeedSubscriberOutputDto {
    return {
      result: {
        id: entity._id.toHexString(),
        discordId: entity.id,
        feed: entity.feed.toHexString(),
        type: entity.type,
        filters: GetFeedOutputDto.getFeedFiltersDto(entity.filters),
      },
    };
  }
}

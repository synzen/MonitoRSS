import {
  FeedSubscriber,
  FeedSubscriberType,
} from "../entities/feed-subscriber.entity";
import { GetFeedOutputDto } from "./GetFeedOutput.dto";

interface FeedSubscribersOutputDto {
  id: string;
  discordId: string;
  filters: Array<{ category: string; value: string }>;
  type: FeedSubscriberType;
  feed: string;
}

export class UpdateFeedSubscriberOutputDto {
  result: FeedSubscribersOutputDto;

  static fromEntity(subscriber: FeedSubscriber): UpdateFeedSubscriberOutputDto {
    return {
      result: {
        id: subscriber._id.toHexString(),
        type: subscriber.type,
        discordId: subscriber.id,
        filters: GetFeedOutputDto.getFeedFiltersDto(subscriber.filters),
        feed: subscriber.feed.toHexString(),
      },
    };
  }
}

import { DetailedFeed } from '../types/detailed-feed.type';
import { GetFeedOutputDto } from './GetFeedOutput.dto';

export class CloneFeedOutputDto {
  results: Array<GetFeedOutputDto['result']>;

  static fromEntity(feeds: DetailedFeed[]): CloneFeedOutputDto {
    return {
      results: feeds.map((feed) => GetFeedOutputDto.fromEntity(feed).result),
    };
  }
}

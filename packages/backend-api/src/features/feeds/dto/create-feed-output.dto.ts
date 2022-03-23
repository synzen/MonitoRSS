import { DetailedFeed } from '../types/detailed-feed.type';
import { GetFeedOutputDto } from './GetFeedOutput.dto';

export class CreateFeedOutputDto {
  results: Array<GetFeedOutputDto['result']>;

  static fromEntity(feeds: DetailedFeed[]): CreateFeedOutputDto {
    return {
      results: feeds.map((f) => GetFeedOutputDto.fromEntity(f).result),
    };
  }
}

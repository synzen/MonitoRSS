import { FeedResponseRequestStatus } from "../../shared";

class ResultDto {
  requestStatus: FeedResponseRequestStatus;
  articles: Array<Record<string, string>>;
}

export class GetUserFeedArticlesOutputDto {
  result: ResultDto;
}

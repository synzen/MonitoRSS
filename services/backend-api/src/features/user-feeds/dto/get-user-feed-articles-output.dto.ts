import { GetArticlesResponseRequestStatus } from "../../../services/feed-handler/types";

class ResultDto {
  requestStatus: GetArticlesResponseRequestStatus;
  articles: Array<Record<string, string>>;
}

export class GetUserFeedArticlesOutputDto {
  result: ResultDto;
}

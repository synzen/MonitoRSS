import { GetFeedArticlesRequestStatus } from "../../shared";

class ResultDto {
  requestStatus: GetFeedArticlesRequestStatus;
  articles: Array<Record<string, string>>;
}

export class GetUserFeedArticlesOutputDto {
  result: ResultDto;
}

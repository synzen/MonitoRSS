import { GetFeedArticlesRequestStatus } from "../../shared";

class FilterStatus {
  passed: boolean;
}

class ResultDto {
  requestStatus: GetFeedArticlesRequestStatus;
  articles: Array<Record<string, string>>;
  filterStatuses?: Array<FilterStatus>;
}

export class GetUserFeedArticlesOutputDto {
  result: ResultDto;
}

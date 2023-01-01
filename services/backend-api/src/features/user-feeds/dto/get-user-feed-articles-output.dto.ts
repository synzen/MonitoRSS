import { GetArticlesResponseRequestStatus } from "../../../services/feed-handler/types";

class FilterStatus {
  passed: boolean;
}

class ResultDto {
  requestStatus: GetArticlesResponseRequestStatus;
  articles: Array<Record<string, string>>;
  filterStatuses?: Array<FilterStatus>;
  selectedProperties: string[];
  totalArticles: number;
  response?: {
    statusCode?: number;
  };
}

export class GetUserFeedArticlesOutputDto {
  result: ResultDto;
}

import { GetFeedArticlesRequestStatus } from "../../shared";

class FilterStatus {
  passed: boolean;
}

class ResultDto {
  requestStatus: GetFeedArticlesRequestStatus;
  response?: {
    statusCode?: number;
  };
  articles: Array<Record<string, string>>;
  totalArticles: number;
  filterStatuses?: Array<FilterStatus>;
  selectedProperties: string[];
  url: string;
  attemptedToResolveFromHtml?: boolean;
  feedTitle: string | null;
}

export class GetUserFeedArticlesOutputDto {
  result: ResultDto;
}

import { GetArticlesResponseRequestStatus } from "../../../services/feed-handler/types";

export interface GetFeedArticlesOutput {
  requestStatus: GetArticlesResponseRequestStatus;
  articles: Array<Record<string, string>>;
  selectedProperties: string[];
  filterStatuses?: Array<{
    passed: boolean;
  }>;
  response?: {
    statusCode?: number;
  };
  totalArticles: number;
}

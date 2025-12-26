import { GetArticlesResponseRequestStatus } from "../../../services/feed-handler/types";

interface ExternalContentError {
  articleId: string;
  sourceField: string;
  label: string;
  cssSelector: string;
  errorType: string;
  message?: string;
  statusCode?: number;
  pageHtml?: string;
  pageHtmlTruncated?: boolean;
}

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
  externalContentErrors?: ExternalContentError[];
}

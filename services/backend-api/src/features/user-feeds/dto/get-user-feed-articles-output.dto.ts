import { GetArticlesResponseRequestStatus } from "../../../services/feed-handler/types";

class FilterStatus {
  passed: boolean;
}

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

class ResultDto {
  requestStatus: GetArticlesResponseRequestStatus;
  articles: Array<Record<string, string>>;
  filterStatuses?: Array<FilterStatus>;
  selectedProperties: string[];
  totalArticles: number;
  response?: {
    statusCode?: number;
  };
  externalContentErrors?: ExternalContentError[];
}

export class GetUserFeedArticlesOutputDto {
  result: ResultDto;
}

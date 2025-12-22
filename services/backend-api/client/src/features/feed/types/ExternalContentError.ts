export enum ExternalContentErrorType {
  FETCH_FAILED = "FETCH_FAILED",
  HTML_PARSE_FAILED = "HTML_PARSE_FAILED",
  INVALID_CSS_SELECTOR = "INVALID_CSS_SELECTOR",
  NO_SELECTOR_MATCH = "NO_SELECTOR_MATCH",
}

export interface ExternalContentError {
  articleId: string;
  sourceField: string;
  label: string;
  cssSelector: string;
  errorType: ExternalContentErrorType;
  message?: string;
  statusCode?: number;
  pageHtml?: string;
  pageHtmlTruncated?: boolean;
}

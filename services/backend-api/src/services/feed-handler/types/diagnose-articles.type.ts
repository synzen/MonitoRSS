export interface DiagnoseArticlesFeedInput {
  id: string;
  url: string;
  blockingComparisons: string[];
  passingComparisons: string[];
  dateChecks?: {
    oldArticleDateDiffMsThreshold?: number;
  };
  formatOptions?: {
    dateFormat?: string;
    dateTimezone?: string;
    dateLocale?: string;
  };
  externalProperties?: Array<{
    sourceField: string;
    label: string;
    cssSelector: string;
  }>;
  requestLookupDetails?: {
    key: string;
    url?: string;
    headers?: Record<string, string>;
  } | null;
}

export interface DiagnoseArticlesMediumInput {
  id: string;
  rateLimits?: Array<{
    limit: number;
    timeWindowSeconds: number;
  }>;
  filters?: {
    expression: unknown;
  };
}

export interface DiagnoseArticlesInput {
  feed: DiagnoseArticlesFeedInput;
  mediums: DiagnoseArticlesMediumInput[];
  articleDayLimit: number;
  skip: number;
  limit: number;
}

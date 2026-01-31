import type { FeedRequestLookupDetails } from "../../shared/types/feed-request-lookup-details.type";

export enum TestDeliveryStatus {
  Success = "SUCCESS",
  ThirdPartyInternalError = "THIRD_PARTY_INTERNAL_ERROR",
  BadPayload = "BAD_PAYLOAD",
  MissingApplicationPermission = "MISSING_APPLICATION_PERMISSION",
  MissingChannel = "MISSING_CHANNEL",
  TooManyRequests = "TOO_MANY_REQUESTS",
  NoArticles = "NO_ARTICLES",
}

export enum GetArticlesResponseRequestStatus {
  ParseError = "PARSE_ERROR",
  Pending = "PENDING",
  Success = "SUCCESS",
  BadStatusCode = "BAD_STATUS_CODE",
  FetchError = "FETCH_ERROR",
  TimedOut = "TIMED_OUT",
  InvalidSslCertificate = "INVALID_SSL_CERTIFICATE",
}

export interface CustomPlaceholderStep {
  id: string;
  type: string;
  regexSearch?: string;
  regexSearchFlags?: string;
  replacementString?: string;
  regexFallback?: string;
  fallbackValue?: string;
  characterCount?: number;
  appendValue?: string;
  prependValue?: string;
  dateFormat?: string;
  dateTimezone?: string;
  dateLocale?: string;
  cssSelector?: string;
  takeFirst?: string;
  uppercaseTitle?: boolean;
}

export interface CustomPlaceholder {
  id: string;
  referenceName: string;
  sourcePlaceholder: string;
  steps: CustomPlaceholderStep[];
}

export interface FeedHandlerRateLimitsResponse {
  results: {
    limits: Array<{
      progress: number;
      max: number;
      remaining: number;
      windowSeconds: number;
    }>;
  };
}

export interface GetDeliveryCountResult {
  result: {
    count: number;
  };
}

export interface SendTestArticleResult {
  status: TestDeliveryStatus;
  apiResponse?: Record<string, unknown>;
  apiPayload?: Record<string, unknown>;
}

export interface CreatePreviewOutput {
  status: TestDeliveryStatus;
  messages?: Array<{
    content?: string;
    embeds?: unknown[];
  }>;
  customPlaceholderPreviews: string[][];
}

interface FilterStatus {
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

export interface GetArticlesResponse {
  result: {
    requestStatus: GetArticlesResponseRequestStatus;
    response?: {
      statusCode?: number;
    };
    articles: Array<Record<string, string>>;
    totalArticles: number;
    filterStatuses?: FilterStatus[];
    selectedProperties: string[];
    url?: string;
    attemptedToResolveFromHtml?: boolean;
    feedTitle?: string | null;
    externalContentErrors?: ExternalContentError[];
  };
}

export interface CreateFilterValidationInput {
  expression: Record<string, unknown>;
}

export interface CreateFilterValidationOutput {
  errors: string[];
}

export interface CreateFilterValidationResponse {
  result: {
    errors: string[];
  };
}

export enum GetFeedArticlesFilterReturnType {
  IncludeEvaluationResults = "include-evaluation-results",
}

export interface GetArticlesInput {
  url: string;
  limit: number;
  skip: number;
  random?: boolean;
  selectProperties?: string[];
  selectPropertyTypes?: string[];
  findRssFromHtml?: boolean;
  executeFetch?: boolean;
  executeFetchIfStale?: boolean;
  includeHtmlInErrors?: boolean;
  filters?: {
    expression?: Record<string, unknown>;
    returnType: GetFeedArticlesFilterReturnType;
    search?: string;
  };
  formatter: {
    options: {
      stripImages: boolean;
      formatTables: boolean;
      dateFormat: string | undefined;
      dateTimezone: string | undefined;
      dateLocale: string | undefined;
      disableImageLinkPreviews: boolean;
    };
    externalProperties?: Array<{
      sourceField: string;
      label: string;
      cssSelector: string;
    }> | null;
    customPlaceholders?: CustomPlaceholder[] | null;
  };
}

export interface SendTestArticleInput {
  details: {
    type: "discord";
    includeCustomPlaceholderPreviews?: boolean;
    feed: {
      url: string;
      formatOptions: {
        dateFormat?: string | undefined;
        dateTimezone?: string | undefined;
        dateLocale?: string;
      };
      externalProperties?: Array<{
        sourceField: string;
        label: string;
        cssSelector: string;
      }> | null;
      requestLookupDetails?: FeedRequestLookupDetails;
    };
    article?: {
      id: string;
    };
    mediumDetails: Record<string, unknown>;
  };
}

export interface CreatePreviewInput {
  details: {
    type: "discord";
    includeCustomPlaceholderPreviews?: boolean;
    feed: {
      url: string;
      formatOptions: {
        dateFormat?: string | undefined;
        dateTimezone?: string | undefined;
        dateLocale?: string;
      };
      externalProperties?: Array<{
        sourceField: string;
        label: string;
        cssSelector: string;
      }> | null;
      requestLookupDetails?: FeedRequestLookupDetails;
    };
    article?: {
      id: string;
    };
    mediumDetails: Record<string, unknown>;
  };
}

export interface DeliveryPreviewFeedInput {
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
  refreshRateSeconds?: number;
}

export interface DeliveryPreviewMediumInput {
  id: string;
  rateLimits?: Array<{
    limit: number;
    timeWindowSeconds: number;
  }>;
  filters?: {
    expression: unknown;
  };
}

export interface DeliveryPreviewInput {
  feed: DeliveryPreviewFeedInput;
  mediums: DeliveryPreviewMediumInput[];
  articleDayLimit: number;
  skip: number;
  limit: number;
}

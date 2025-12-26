/**
 * Feed-level state returned when delivery preview cannot be generated
 * (feed is unchanged, pending, or has errors)
 */
export enum FeedState {
  /** Feed content is unchanged (hash matches stored hash) */
  Unchanged = "unchanged",
  /** Feed request is pending */
  Pending = "pending",
  /** Feed fetch failed (network, timeout, bad status code, etc.) */
  FetchError = "fetch-error",
  /** Feed parse failed (invalid XML, timeout, etc.) */
  ParseError = "parse-error",
}

/**
 * Primary delivery outcome - why the article would or would not be delivered
 */
export enum ArticleDeliveryOutcome {
  /** Article would be delivered successfully */
  WouldDeliver = "would-deliver",
  /** Feed is in first-run mode - article would be stored but not delivered */
  FirstRunBaseline = "first-run-baseline",
  /** Article ID already seen (duplicate) */
  DuplicateId = "duplicate-id",
  /** Article blocked by blocking comparison fields */
  BlockedByComparison = "blocked-by-comparison",
  /** Article filtered out by date checks (too old) */
  FilteredByDateCheck = "filtered-by-date-check",
  /** Article filtered out by medium filters */
  FilteredByMediumFilter = "filtered-by-medium-filter",
  /** Would be rate limited by feed daily limit */
  RateLimitedFeed = "rate-limited-feed",
  /** Would be rate limited by medium rate limits */
  RateLimitedMedium = "rate-limited-medium",
  /** Article passes comparisons (already seen, but field changed) */
  WouldDeliverPassingComparison = "would-deliver-passing-comparison",
  /** Different outcomes across mediums */
  MixedResults = "mixed-results",
  /** Feed content has not changed (hash matches stored hash) */
  FeedUnchanged = "feed-unchanged",
  /** Feed fetch or parse failed */
  FeedError = "feed-error",
}

/**
 * Stages in the article processing pipeline
 */
export enum DeliveryPreviewStage {
  FeedState = "feed-state",
  IdComparison = "id-comparison",
  BlockingComparison = "blocking-comparison",
  PassingComparison = "passing-comparison",
  DateCheck = "date-check",
  MediumFilter = "medium-filter",
  FeedRateLimit = "feed-rate-limit",
  MediumRateLimit = "medium-rate-limit",
}

/**
 * Status of a delivery preview stage
 */
export enum DeliveryPreviewStageStatus {
  Passed = "passed",
  Failed = "failed",
  Skipped = "skipped",
}

/**
 * Canonical list of all delivery preview stages in processing order.
 * Used by frontend to determine which stages were skipped.
 */
export const CANONICAL_STAGES: DeliveryPreviewStage[] = [
  DeliveryPreviewStage.FeedState,
  DeliveryPreviewStage.IdComparison,
  DeliveryPreviewStage.BlockingComparison,
  DeliveryPreviewStage.PassingComparison,
  DeliveryPreviewStage.DateCheck,
  DeliveryPreviewStage.FeedRateLimit,
  DeliveryPreviewStage.MediumFilter,
  DeliveryPreviewStage.MediumRateLimit,
];

export interface FeedStateDeliveryPreviewDetails {
  hasPriorArticles: boolean;
  isFirstRun: boolean;
  storedComparisonNames: string[];
}

export interface IdComparisonDeliveryPreviewDetails {
  articleIdHash: string;
  foundInHotPartition: boolean;
  foundInColdPartition: boolean;
  isNew: boolean;
}

export interface BlockingComparisonDeliveryPreviewDetails {
  comparisonFields: string[];
  activeFields: string[];
  blockedByFields: string[];
}

export interface PassingComparisonDeliveryPreviewDetails {
  comparisonFields: string[];
  activeFields: string[];
  changedFields: string[];
}

export interface DateCheckDeliveryPreviewDetails {
  articleDate: string | null;
  threshold: number | null;
  datePlaceholders: string[];
  ageMs: number | null;
  withinThreshold: boolean;
}

export interface FilterExplainBlockedDetail {
  message: string;
  truncatedReferenceValue: string | null;
  filterInput: string;
  fieldName: string;
  operator: string;
  isNegated: boolean;
}

export interface MediumFilterDeliveryPreviewDetails {
  mediumId: string;
  filterExpression: unknown | null;
  filterResult: boolean;
  explainBlocked: FilterExplainBlockedDetail[];
  explainMatched: FilterExplainBlockedDetail[];
}

export interface RateLimitDeliveryPreviewDetails {
  currentCount: number;
  limit: number;
  timeWindowSeconds: number;
  remaining: number;
  wouldExceed: boolean;
}

export interface FeedStateDeliveryPreviewResult {
  stage: DeliveryPreviewStage.FeedState;
  status: DeliveryPreviewStageStatus;
  details: FeedStateDeliveryPreviewDetails;
}

export interface IdComparisonDeliveryPreviewResult {
  stage: DeliveryPreviewStage.IdComparison;
  status: DeliveryPreviewStageStatus;
  details: IdComparisonDeliveryPreviewDetails;
}

export interface BlockingComparisonDeliveryPreviewResult {
  stage: DeliveryPreviewStage.BlockingComparison;
  status: DeliveryPreviewStageStatus;
  details: BlockingComparisonDeliveryPreviewDetails;
}

export interface PassingComparisonDeliveryPreviewResult {
  stage: DeliveryPreviewStage.PassingComparison;
  status: DeliveryPreviewStageStatus;
  details: PassingComparisonDeliveryPreviewDetails;
}

export interface DateCheckDeliveryPreviewResult {
  stage: DeliveryPreviewStage.DateCheck;
  status: DeliveryPreviewStageStatus;
  details: DateCheckDeliveryPreviewDetails;
}

export interface MediumFilterDeliveryPreviewResult {
  stage: DeliveryPreviewStage.MediumFilter;
  status: DeliveryPreviewStageStatus;
  details: MediumFilterDeliveryPreviewDetails;
}

export interface FeedRateLimitDeliveryPreviewResult {
  stage: DeliveryPreviewStage.FeedRateLimit;
  status: DeliveryPreviewStageStatus;
  details: RateLimitDeliveryPreviewDetails;
}

export interface MediumRateLimitDeliveryPreviewResult {
  stage: DeliveryPreviewStage.MediumRateLimit;
  status: DeliveryPreviewStageStatus;
  details: RateLimitDeliveryPreviewDetails & { mediumId: string };
}

export interface SkippedDeliveryPreviewResult {
  stage: DeliveryPreviewStage;
  status: DeliveryPreviewStageStatus.Skipped;
  details: null;
}

export type DeliveryPreviewStageResult =
  | FeedStateDeliveryPreviewResult
  | IdComparisonDeliveryPreviewResult
  | BlockingComparisonDeliveryPreviewResult
  | PassingComparisonDeliveryPreviewResult
  | DateCheckDeliveryPreviewResult
  | MediumFilterDeliveryPreviewResult
  | FeedRateLimitDeliveryPreviewResult
  | MediumRateLimitDeliveryPreviewResult
  | SkippedDeliveryPreviewResult;

/**
 * Delivery preview result for a single medium (connection)
 */
export interface MediumDeliveryResult {
  mediumId: string;
  outcome: ArticleDeliveryOutcome;
  outcomeReason: string;
  stages: DeliveryPreviewStageResult[];
}

/**
 * Summary version of medium delivery result (without stages array)
 */
export interface MediumDeliverySummary {
  mediumId: string;
  outcome: ArticleDeliveryOutcome;
  outcomeReason: string;
}

/**
 * Complete delivery preview result for a single article with per-medium outcomes
 */
export interface ArticleDeliveryResult {
  articleId: string;
  articleIdHash: string;
  articleTitle: string | null;
  outcome: ArticleDeliveryOutcome;
  outcomeReason: string;
  mediumResults: MediumDeliveryResult[];
}

/**
 * Summary version of delivery result (without stages in medium results)
 */
export interface ArticleDeliverySummary {
  articleId: string;
  articleIdHash: string;
  articleTitle: string | null;
  outcome: ArticleDeliveryOutcome;
  outcomeReason: string;
  mediumResults: MediumDeliverySummary[];
}

/**
 * Response for batch article delivery preview
 */
export interface DeliveryPreviewResponse {
  results: ArticleDeliveryResult[] | ArticleDeliverySummary[];
  errors: Array<{ articleId: string; message: string }>;
  stages: DeliveryPreviewStage[];
}

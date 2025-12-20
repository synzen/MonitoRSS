/**
 * Feed-level state returned when articles cannot be diagnosed
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
 * Primary diagnosis outcome - why the article would or would not be delivered
 */
export enum ArticleDiagnosisOutcome {
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
export enum DiagnosticStage {
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
 * Status of a diagnostic stage
 */
export enum DiagnosticStageStatus {
  Passed = "passed",
  Failed = "failed",
  Skipped = "skipped",
}

/**
 * Canonical list of all diagnostic stages in processing order.
 * Used by frontend to determine which stages were skipped.
 */
export const CANONICAL_STAGES: DiagnosticStage[] = [
  DiagnosticStage.FeedState,
  DiagnosticStage.IdComparison,
  DiagnosticStage.BlockingComparison,
  DiagnosticStage.PassingComparison,
  DiagnosticStage.DateCheck,
  DiagnosticStage.FeedRateLimit,
  DiagnosticStage.MediumFilter,
  DiagnosticStage.MediumRateLimit,
];

export interface FeedStateDiagnosticDetails {
  hasPriorArticles: boolean;
  isFirstRun: boolean;
  storedComparisonNames: string[];
}

export interface IdComparisonDiagnosticDetails {
  articleIdHash: string;
  foundInHotPartition: boolean;
  foundInColdPartition: boolean;
  isNew: boolean;
}

export interface BlockingComparisonDiagnosticDetails {
  comparisonFields: string[];
  activeFields: string[];
  blockedByFields: string[];
}

export interface PassingComparisonDiagnosticDetails {
  comparisonFields: string[];
  activeFields: string[];
  changedFields: string[];
}

export interface DateCheckDiagnosticDetails {
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

export interface MediumFilterDiagnosticDetails {
  mediumId: string;
  filterExpression: unknown | null;
  filterResult: boolean;
  explainBlocked: FilterExplainBlockedDetail[];
  explainMatched: FilterExplainBlockedDetail[];
}

export interface RateLimitDiagnosticDetails {
  currentCount: number;
  limit: number;
  timeWindowSeconds: number;
  remaining: number;
  wouldExceed: boolean;
}

export interface FeedStateDiagnosticResult {
  stage: DiagnosticStage.FeedState;
  status: DiagnosticStageStatus;
  details: FeedStateDiagnosticDetails;
}

export interface IdComparisonDiagnosticResult {
  stage: DiagnosticStage.IdComparison;
  status: DiagnosticStageStatus;
  details: IdComparisonDiagnosticDetails;
}

export interface BlockingComparisonDiagnosticResult {
  stage: DiagnosticStage.BlockingComparison;
  status: DiagnosticStageStatus;
  details: BlockingComparisonDiagnosticDetails;
}

export interface PassingComparisonDiagnosticResult {
  stage: DiagnosticStage.PassingComparison;
  status: DiagnosticStageStatus;
  details: PassingComparisonDiagnosticDetails;
}

export interface DateCheckDiagnosticResult {
  stage: DiagnosticStage.DateCheck;
  status: DiagnosticStageStatus;
  details: DateCheckDiagnosticDetails;
}

export interface MediumFilterDiagnosticResult {
  stage: DiagnosticStage.MediumFilter;
  status: DiagnosticStageStatus;
  details: MediumFilterDiagnosticDetails;
}

export interface FeedRateLimitDiagnosticResult {
  stage: DiagnosticStage.FeedRateLimit;
  status: DiagnosticStageStatus;
  details: RateLimitDiagnosticDetails;
}

export interface MediumRateLimitDiagnosticResult {
  stage: DiagnosticStage.MediumRateLimit;
  status: DiagnosticStageStatus;
  details: RateLimitDiagnosticDetails & { mediumId: string };
}

export interface SkippedDiagnosticResult {
  stage: DiagnosticStage;
  status: DiagnosticStageStatus.Skipped;
  details: null;
}

export type DiagnosticStageResult =
  | FeedStateDiagnosticResult
  | IdComparisonDiagnosticResult
  | BlockingComparisonDiagnosticResult
  | PassingComparisonDiagnosticResult
  | DateCheckDiagnosticResult
  | MediumFilterDiagnosticResult
  | FeedRateLimitDiagnosticResult
  | MediumRateLimitDiagnosticResult
  | SkippedDiagnosticResult;

/**
 * Diagnostic result for a single medium (connection)
 */
export interface MediumDiagnosticResult {
  mediumId: string;
  outcome: ArticleDiagnosisOutcome;
  outcomeReason: string;
  stages: DiagnosticStageResult[];
}

/**
 * Summary version of medium diagnostic result (without stages array)
 */
export interface MediumDiagnosisSummary {
  mediumId: string;
  outcome: ArticleDiagnosisOutcome;
  outcomeReason: string;
}

/**
 * Complete diagnostic result for a single article with per-medium outcomes
 */
export interface ArticleDiagnosticResult {
  articleId: string;
  articleIdHash: string;
  articleTitle: string | null;
  outcome: ArticleDiagnosisOutcome;
  outcomeReason: string;
  mediumResults: MediumDiagnosticResult[];
}

/**
 * Summary version of diagnostic result (without stages in medium results)
 */
export interface ArticleDiagnosisSummary {
  articleId: string;
  articleIdHash: string;
  articleTitle: string | null;
  outcome: ArticleDiagnosisOutcome;
  outcomeReason: string;
  mediumResults: MediumDiagnosisSummary[];
}

/**
 * Response for batch article diagnosis
 */
export interface DiagnoseArticlesResponse {
  results: ArticleDiagnosticResult[] | ArticleDiagnosisSummary[];
  errors: Array<{ articleId: string; message: string }>;
  stages: DiagnosticStage[];
}

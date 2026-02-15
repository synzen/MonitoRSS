import { InferType, array, boolean, number, object, string, mixed } from "yup";

export enum ArticleDeliveryOutcome {
  WouldDeliver = "would-deliver",
  FirstRunBaseline = "first-run-baseline",
  DuplicateId = "duplicate-id",
  BlockedByComparison = "blocked-by-comparison",
  FilteredByDateCheck = "filtered-by-date-check",
  FilteredByMediumFilter = "filtered-by-medium-filter",
  RateLimitedFeed = "rate-limited-feed",
  RateLimitedMedium = "rate-limited-medium",
  WouldDeliverPassingComparison = "would-deliver-passing-comparison",
  MixedResults = "mixed-results",
  FeedUnchanged = "feed-unchanged",
  FeedError = "feed-error",
}

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

export enum DeliveryPreviewStageStatus {
  Passed = "passed",
  Failed = "failed",
  Skipped = "skipped",
}

export const FeedStateDeliveryPreviewDetailsSchema = object({
  hasPriorArticles: boolean().required(),
  isFirstRun: boolean().required(),
  storedComparisonNames: array(string().required()).required(),
});

export const IdComparisonDeliveryPreviewDetailsSchema = object({
  articleIdHash: string().required(),
  foundInHotPartition: boolean().required(),
  foundInColdPartition: boolean().required(),
  isNew: boolean().required(),
});

export const BlockingComparisonDeliveryPreviewDetailsSchema = object({
  comparisonFields: array(string().required()).required(),
  activeFields: array(string().required()).required(),
  blockedByFields: array(string().required()).required(),
});

export const PassingComparisonDeliveryPreviewDetailsSchema = object({
  comparisonFields: array(string().required()).required(),
  activeFields: array(string().required()).required(),
  changedFields: array(string().required()).required(),
});

export const DateCheckDeliveryPreviewDetailsSchema = object({
  articleDate: string().nullable(),
  threshold: number().nullable(),
  datePlaceholders: array(string().required()).required(),
  ageMs: number().nullable(),
  withinThreshold: boolean().required(),
});

export const FilterExplainBlockedDetailSchema = object({
  message: string().required(),
  truncatedReferenceValue: string().nullable(),
  filterInput: string().required(),
  fieldName: string().required(),
  operator: string().required(),
  isNegated: boolean().required(),
});

export const MediumFilterDeliveryPreviewDetailsSchema = object({
  mediumId: string().required(),
  filterExpression: mixed().nullable(),
  filterResult: boolean().required(),
  explainBlocked: array(FilterExplainBlockedDetailSchema.required()).required(),
  explainMatched: array(FilterExplainBlockedDetailSchema.required()).required(),
});

export const RateLimitDeliveryPreviewDetailsSchema = object({
  currentCount: number().required(),
  limit: number().required(),
  timeWindowSeconds: number().required(),
  remaining: number().required(),
  wouldExceed: boolean().required(),
});

/**
 * Schema for backend response format (with status enum).
 * The frontend adds summary strings to this.
 */
export const BackendStageResultSchema = object({
  stage: string().oneOf(Object.values(DeliveryPreviewStage)).required() as any,
  status: string().oneOf(Object.values(DeliveryPreviewStageStatus)).required() as any,
  details: object().nullable(),
});

export const DeliveryPreviewStageResultSchema = object({
  stage: string().oneOf(Object.values(DeliveryPreviewStage)).required(),
  status: string().oneOf(Object.values(DeliveryPreviewStageStatus)).required() as any,
  summary: string().required(),
  details: object().nullable(),
});

/**
 * Schema for backend medium result format (with passed boolean in stages).
 */
export const BackendMediumDeliveryResultSchema = object({
  mediumId: string().required(),
  outcome: string().oneOf(Object.values(ArticleDeliveryOutcome)).required() as any,
  outcomeReason: string().required(),
  stages: array(BackendStageResultSchema.required()).required(),
});

/**
 * Schema for backend article result format.
 */
export const BackendArticleDeliveryResultSchema = object({
  articleId: string().required(),
  articleIdHash: string().required(),
  articleTitle: string().nullable(),
  outcome: string().oneOf(Object.values(ArticleDeliveryOutcome)).required() as any,
  outcomeReason: string().required(),
  mediumResults: array(BackendMediumDeliveryResultSchema.required()).required(),
});

export const MediumDeliveryResultSchema = object({
  mediumId: string().required(),
  outcome: string().oneOf(Object.values(ArticleDeliveryOutcome)).required() as any,
  outcomeReason: string().required(),
  stages: array(DeliveryPreviewStageResultSchema.required()).required(),
});

export const ArticleDeliveryResultSchema = object({
  articleId: string().required(),
  articleIdHash: string().required(),
  articleTitle: string().nullable(),
  outcome: string().oneOf(Object.values(ArticleDeliveryOutcome)).required() as any,
  outcomeReason: string().required(),
  mediumResults: array(MediumDeliveryResultSchema.required()).required(),
});

export type FeedStateDeliveryPreviewDetails = InferType<
  typeof FeedStateDeliveryPreviewDetailsSchema
>;
export type IdComparisonDeliveryPreviewDetails = InferType<
  typeof IdComparisonDeliveryPreviewDetailsSchema
>;
export type BlockingComparisonDeliveryPreviewDetails = InferType<
  typeof BlockingComparisonDeliveryPreviewDetailsSchema
>;
export type PassingComparisonDeliveryPreviewDetails = InferType<
  typeof PassingComparisonDeliveryPreviewDetailsSchema
>;
export type DateCheckDeliveryPreviewDetails = InferType<
  typeof DateCheckDeliveryPreviewDetailsSchema
>;
export type FilterExplainBlockedDetail = InferType<typeof FilterExplainBlockedDetailSchema>;
export type MediumFilterDeliveryPreviewDetails = InferType<
  typeof MediumFilterDeliveryPreviewDetailsSchema
>;
export type RateLimitDeliveryPreviewDetails = InferType<
  typeof RateLimitDeliveryPreviewDetailsSchema
>;

export type BackendStageResult = InferType<typeof BackendStageResultSchema>;
export type BackendMediumDeliveryResult = InferType<typeof BackendMediumDeliveryResultSchema>;
export type BackendArticleDeliveryResult = InferType<typeof BackendArticleDeliveryResultSchema>;

export type DeliveryPreviewStageResult = InferType<typeof DeliveryPreviewStageResultSchema>;
export type MediumDeliveryResult = InferType<typeof MediumDeliveryResultSchema>;
export type ArticleDeliveryResult = InferType<typeof ArticleDeliveryResultSchema>;

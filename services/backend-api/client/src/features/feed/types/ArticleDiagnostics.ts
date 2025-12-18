import { InferType, array, boolean, number, object, string, mixed } from "yup";

export enum ArticleDiagnosisOutcome {
  WouldDeliver = "would-deliver",
  FirstRunBaseline = "first-run-baseline",
  DuplicateId = "duplicate-id",
  BlockedByComparison = "blocked-by-comparison",
  FilteredByDateCheck = "filtered-by-date-check",
  FilteredByMediumFilter = "filtered-by-medium-filter",
  RateLimitedFeed = "rate-limited-feed",
  RateLimitedMedium = "rate-limited-medium",
  WouldDeliverPassingComparison = "would-deliver-passing-comparison",
}

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

export enum DiagnosticStageStatus {
  Passed = "passed",
  Failed = "failed",
  Skipped = "skipped",
}

export const FeedStateDiagnosticDetailsSchema = object({
  hasPriorArticles: boolean().required(),
  isFirstRun: boolean().required(),
  storedComparisonNames: array(string().required()).required(),
});

export const IdComparisonDiagnosticDetailsSchema = object({
  articleIdHash: string().required(),
  foundInHotPartition: boolean().required(),
  foundInColdPartition: boolean().required(),
  isNew: boolean().required(),
});

export const BlockingComparisonDiagnosticDetailsSchema = object({
  comparisonFields: array(string().required()).required(),
  activeFields: array(string().required()).required(),
  blockedByFields: array(string().required()).required(),
});

export const PassingComparisonDiagnosticDetailsSchema = object({
  comparisonFields: array(string().required()).required(),
  activeFields: array(string().required()).required(),
  changedFields: array(string().required()).required(),
});

export const DateCheckDiagnosticDetailsSchema = object({
  articleDate: string().nullable(),
  threshold: number().nullable(),
  datePlaceholders: array(string().required()).required(),
  ageMs: number().nullable(),
  withinThreshold: boolean().required(),
});

export const MediumFilterDiagnosticDetailsSchema = object({
  mediumId: string().required(),
  filterExpression: mixed().nullable(),
  filterResult: boolean().required(),
  explainBlocked: array(string().required()).required(),
});

export const RateLimitDiagnosticDetailsSchema = object({
  currentCount: number().required(),
  limit: number().required(),
  timeWindowSeconds: number().required(),
  remaining: number().required(),
  wouldExceed: boolean().required(),
});

export const DiagnosticStageResultSchema = object({
  stage: string().oneOf(Object.values(DiagnosticStage)).required() as any,
  status: string().oneOf(Object.values(DiagnosticStageStatus)).required() as any,
  summary: string().required(),
  details: object().nullable(),
});

export const MediumDiagnosticResultSchema = object({
  mediumId: string().required(),
  outcome: string().oneOf(Object.values(ArticleDiagnosisOutcome)).required() as any,
  outcomeReason: string().required(),
  stages: array(DiagnosticStageResultSchema.required()).required(),
});

export const ArticleDiagnosticResultSchema = object({
  articleId: string().required(),
  articleIdHash: string().required(),
  articleTitle: string().nullable(),
  outcome: string().oneOf(Object.values(ArticleDiagnosisOutcome)).required() as any,
  outcomeReason: string().required(),
  mediumResults: array(MediumDiagnosticResultSchema.required()).required(),
});

export type FeedStateDiagnosticDetails = InferType<typeof FeedStateDiagnosticDetailsSchema>;
export type IdComparisonDiagnosticDetails = InferType<typeof IdComparisonDiagnosticDetailsSchema>;
export type BlockingComparisonDiagnosticDetails = InferType<
  typeof BlockingComparisonDiagnosticDetailsSchema
>;
export type PassingComparisonDiagnosticDetails = InferType<
  typeof PassingComparisonDiagnosticDetailsSchema
>;
export type DateCheckDiagnosticDetails = InferType<typeof DateCheckDiagnosticDetailsSchema>;
export type MediumFilterDiagnosticDetails = InferType<typeof MediumFilterDiagnosticDetailsSchema>;
export type RateLimitDiagnosticDetails = InferType<typeof RateLimitDiagnosticDetailsSchema>;

export type DiagnosticStageResult = InferType<typeof DiagnosticStageResultSchema>;
export type MediumDiagnosticResult = InferType<typeof MediumDiagnosticResultSchema>;
export type ArticleDiagnosticResult = InferType<typeof ArticleDiagnosticResultSchema>;

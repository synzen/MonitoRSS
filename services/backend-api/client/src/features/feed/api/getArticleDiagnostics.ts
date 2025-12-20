import { array, InferType, mixed, number, object, string } from "yup";
import fetchRest from "../../../utils/fetchRest";
import {
  ArticleDiagnosticResultSchema,
  BackendArticleDiagnosticResultSchema,
  BackendStageResult,
  DiagnosticStage,
  DiagnosticStageStatus,
  DiagnosticStageResult,
  MediumDiagnosticResult,
  ArticleDiagnosticResult,
} from "../types/ArticleDiagnostics";

export interface GetArticleDiagnosticsInput {
  feedId: string;
  data: {
    skip: number;
    limit: number;
  };
}

/**
 * Schema for validating backend response (with status enum in stages).
 */
const BackendGetArticleDiagnosticsOutputSchema = object({
  result: object()
    .shape({
      results: array(BackendArticleDiagnosticResultSchema).required(),
      total: number().required(),
      stages: array(string().required()).required(),
      feedState: mixed<{ state: string; errorType?: string; httpStatusCode?: number }>(),
    })
    .required(),
}).required();

type BackendGetArticleDiagnosticsOutput = InferType<
  typeof BackendGetArticleDiagnosticsOutputSchema
>;

/**
 * Schema for the transformed frontend output.
 */
const GetArticleDiagnosticsOutputSchema = object({
  result: object()
    .shape({
      results: array(ArticleDiagnosticResultSchema).required(),
      total: number().required(),
      stages: array(string().required()).required(),
      feedState: mixed<{ state: string; errorType?: string; httpStatusCode?: number }>(),
    })
    .required(),
}).required();

export type GetArticleDiagnosticsOutput = InferType<typeof GetArticleDiagnosticsOutputSchema>;

/**
 * Generate a human-readable summary for a diagnostic stage.
 */
function generateStageSummary(
  stage: DiagnosticStage,
  status: DiagnosticStageStatus,
  details: Record<string, unknown> | null
): string {
  const passed = status === DiagnosticStageStatus.Passed;

  switch (stage) {
    case DiagnosticStage.FeedState:
      return passed ? "Feed is ready" : "Recording existing articles";

    case DiagnosticStage.IdComparison:
      return passed ? "New article" : "Already processed";

    case DiagnosticStage.BlockingComparison: {
      if (passed) {
        const fields = details?.comparisonFields as string[] | undefined;

        return !fields?.length ? "Not configured" : "Content has changed";
      }

      const blocked = details?.blockedByFields as string[] | undefined;

      return blocked?.length ? `No changes in ${blocked.join(", ")}` : "No changes detected";
    }

    case DiagnosticStage.PassingComparison: {
      if (passed) {
        const changed = details?.changedFields as string[] | undefined;

        return changed?.length ? `${changed.join(", ")} updated` : "Fields updated";
      }

      return "No updates detected";
    }

    case DiagnosticStage.DateCheck:
      return passed ? "Article is recent" : "Article is too old";

    case DiagnosticStage.MediumFilter:
      return passed ? "Matches your filters" : "Doesn't match filters";

    case DiagnosticStage.FeedRateLimit: {
      const current = (details?.currentCount as number) ?? 0;
      const limit = (details?.limit as number) ?? 0;

      return passed ? `${current} of ${limit} today` : `Limit reached (${current}/${limit})`;
    }

    case DiagnosticStage.MediumRateLimit: {
      const current = (details?.currentCount as number) ?? 0;
      const limit = (details?.limit as number) ?? 0;

      return passed ? `${current} of ${limit} this hour` : `Limit reached (${current}/${limit})`;
    }

    default:
      return passed ? "Passed" : "Failed";
  }
}

/**
 * Generate a summary for a skipped stage based on context.
 */
function generateSkippedSummary(stage: DiagnosticStage, stages: BackendStageResult[]): string {
  // Find the first failed stage to determine skip reason
  const firstFailedStage = stages.find((s) => s.status === DiagnosticStageStatus.Failed);
  const failedStage = firstFailedStage?.stage as DiagnosticStage | undefined;

  if (failedStage === DiagnosticStage.FeedState) {
    return "Skipped during initial scan";
  }

  if (failedStage === DiagnosticStage.IdComparison) {
    return "Skipped - already processed";
  }

  if (stage === DiagnosticStage.PassingComparison) {
    return "Not configured";
  }

  return "Skipped - blocked above";
}

/**
 * Transform a backend stage result to frontend format by adding summary.
 */
function transformStage(
  backendStage: BackendStageResult,
  allStages: BackendStageResult[]
): DiagnosticStageResult {
  const stage = backendStage.stage as DiagnosticStage;
  const status = backendStage.status as DiagnosticStageStatus;

  // Generate summary based on status
  const summary =
    status === DiagnosticStageStatus.Skipped
      ? generateSkippedSummary(stage, allStages)
      : generateStageSummary(stage, status, backendStage.details as Record<string, unknown> | null);

  return {
    stage: backendStage.stage,
    status,
    summary,
    details: backendStage.details,
  };
}

/**
 * Transform the backend response to frontend format.
 */
function transformResponse(
  backendResponse: BackendGetArticleDiagnosticsOutput
): GetArticleDiagnosticsOutput {
  const canonicalStages = backendResponse.result.stages;

  const transformedResults: ArticleDiagnosticResult[] = backendResponse.result.results.map(
    (article) => ({
      articleId: article.articleId,
      articleIdHash: article.articleIdHash,
      articleTitle: article.articleTitle,
      outcome: article.outcome,
      outcomeReason: article.outcomeReason,
      mediumResults: article.mediumResults.map((medium): MediumDiagnosticResult => {
        // Backend now returns complete stage list with status - just add summaries
        const transformedStages = medium.stages.map((stage) =>
          transformStage(stage, medium.stages)
        );

        return {
          mediumId: medium.mediumId,
          outcome: medium.outcome,
          outcomeReason: medium.outcomeReason,
          stages: transformedStages,
        };
      }),
    })
  );

  return {
    result: {
      results: transformedResults,
      total: backendResponse.result.total,
      stages: canonicalStages,
      feedState: backendResponse.result.feedState,
    },
  };
}

export const getArticleDiagnostics = async ({
  feedId,
  data,
}: GetArticleDiagnosticsInput): Promise<GetArticleDiagnosticsOutput> => {
  // Fetch with backend schema that accepts status enum
  const backendRes = (await fetchRest(`/api/v1/user-feeds/${feedId}/diagnose-articles`, {
    requestOptions: {
      method: "POST",
      body: JSON.stringify({
        skip: data.skip,
        limit: data.limit,
      }),
    },
    validateSchema: BackendGetArticleDiagnosticsOutputSchema,
  })) as BackendGetArticleDiagnosticsOutput;

  // Transform to frontend format with summaries
  const transformedRes = transformResponse(backendRes);

  return transformedRes;
};

import { array, InferType, mixed, number, object, string } from "yup";
import fetchRest from "../../../utils/fetchRest";
import {
  ArticleDeliveryResultSchema,
  BackendArticleDeliveryResultSchema,
  BackendStageResult,
  DeliveryPreviewStage,
  DeliveryPreviewStageStatus,
  DeliveryPreviewStageResult,
  MediumDeliveryResult,
  ArticleDeliveryResult,
} from "../types/DeliveryPreview";

export interface GetDeliveryPreviewInput {
  feedId: string;
  data: {
    skip: number;
    limit: number;
  };
}

/**
 * Schema for validating backend response (with status enum in stages).
 */
const BackendGetDeliveryPreviewOutputSchema = object({
  result: object()
    .shape({
      results: array(BackendArticleDeliveryResultSchema).required(),
      total: number().required(),
      stages: array(string().required()).required(),
      feedState: mixed<{ state: string; errorType?: string; httpStatusCode?: number }>(),
    })
    .required(),
}).required();

type BackendGetDeliveryPreviewOutput = InferType<
  typeof BackendGetDeliveryPreviewOutputSchema
>;

/**
 * Schema for the transformed frontend output.
 */
const GetDeliveryPreviewOutputSchema = object({
  result: object()
    .shape({
      results: array(ArticleDeliveryResultSchema).required(),
      total: number().required(),
      stages: array(string().required()).required(),
      feedState: mixed<{ state: string; errorType?: string; httpStatusCode?: number }>(),
    })
    .required(),
}).required();

export type GetDeliveryPreviewOutput = InferType<typeof GetDeliveryPreviewOutputSchema>;

/**
 * Generate a human-readable summary for a delivery preview stage.
 */
function generateStageSummary(
  stage: DeliveryPreviewStage,
  status: DeliveryPreviewStageStatus,
  details: Record<string, unknown> | null
): string {
  const passed = status === DeliveryPreviewStageStatus.Passed;

  switch (stage) {
    case DeliveryPreviewStage.FeedState:
      return passed ? "Feed is ready" : "Recording existing articles";

    case DeliveryPreviewStage.IdComparison:
      return passed ? "New article" : "Already processed";

    case DeliveryPreviewStage.BlockingComparison: {
      if (passed) {
        const fields = details?.comparisonFields as string[] | undefined;

        return !fields?.length ? "Not configured" : "Content has changed";
      }

      const blocked = details?.blockedByFields as string[] | undefined;

      return blocked?.length ? `No changes in ${blocked.join(", ")}` : "No changes detected";
    }

    case DeliveryPreviewStage.PassingComparison: {
      if (passed) {
        const changed = details?.changedFields as string[] | undefined;

        return changed?.length ? `${changed.join(", ")} updated` : "Fields updated";
      }

      return "No updates detected";
    }

    case DeliveryPreviewStage.DateCheck:
      return passed ? "Article is recent" : "Article is too old";

    case DeliveryPreviewStage.MediumFilter:
      return passed ? "Matches your filters" : "Doesn't match filters";

    case DeliveryPreviewStage.FeedRateLimit: {
      const current = (details?.currentCount as number) ?? 0;
      const limit = (details?.limit as number) ?? 0;

      return passed ? `${current} of ${limit} today` : `Limit reached (${current}/${limit})`;
    }

    case DeliveryPreviewStage.MediumRateLimit: {
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
function generateSkippedSummary(stage: DeliveryPreviewStage, stages: BackendStageResult[]): string {
  // Find the first failed stage to determine skip reason
  const firstFailedStage = stages.find((s) => s.status === DeliveryPreviewStageStatus.Failed);
  const failedStage = firstFailedStage?.stage as DeliveryPreviewStage | undefined;

  if (failedStage === DeliveryPreviewStage.FeedState) {
    return "Skipped during initial scan";
  }

  if (failedStage === DeliveryPreviewStage.IdComparison) {
    return "Skipped - already processed";
  }

  if (stage === DeliveryPreviewStage.PassingComparison) {
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
): DeliveryPreviewStageResult {
  const stage = backendStage.stage as DeliveryPreviewStage;
  const status = backendStage.status as DeliveryPreviewStageStatus;

  // Generate summary based on status
  const summary =
    status === DeliveryPreviewStageStatus.Skipped
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
  backendResponse: BackendGetDeliveryPreviewOutput
): GetDeliveryPreviewOutput {
  const canonicalStages = backendResponse.result.stages;

  const transformedResults: ArticleDeliveryResult[] = backendResponse.result.results.map(
    (article) => ({
      articleId: article.articleId,
      articleIdHash: article.articleIdHash,
      articleTitle: article.articleTitle,
      outcome: article.outcome,
      outcomeReason: article.outcomeReason,
      mediumResults: article.mediumResults.map((medium): MediumDeliveryResult => {
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

export const getDeliveryPreview = async ({
  feedId,
  data,
}: GetDeliveryPreviewInput): Promise<GetDeliveryPreviewOutput> => {
  // Fetch with backend schema that accepts status enum
  const backendRes = (await fetchRest(`/api/v1/user-feeds/${feedId}/delivery-preview`, {
    requestOptions: {
      method: "POST",
      body: JSON.stringify({
        skip: data.skip,
        limit: data.limit,
      }),
    },
    validateSchema: BackendGetDeliveryPreviewOutputSchema,
  })) as BackendGetDeliveryPreviewOutput;

  // Transform to frontend format with summaries
  const transformedRes = transformResponse(backendRes);

  return transformedRes;
};

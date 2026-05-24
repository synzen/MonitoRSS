import {
  isDeliveryPreviewMode,
  recordDeliveryPreviewForArticle,
  DeliveryPreviewStage,
  DeliveryPreviewStageStatus,
} from "../../shared/delivery-preview";
import type {
  RateLimitDiagnosticParams,
  MediumFilterDiagnosticParams,
} from "../types";

export function recordRateLimitDiagnostic(
  params: RateLimitDiagnosticParams
): void {
  if (!isDeliveryPreviewMode()) {
    return;
  }

  const wouldExceed = params.remaining <= 0;

  const status = wouldExceed ? DeliveryPreviewStageStatus.Failed : DeliveryPreviewStageStatus.Passed;

  if (params.isFeedLevel) {
    recordDeliveryPreviewForArticle(params.articleIdHash, {
      stage: DeliveryPreviewStage.FeedRateLimit,
      status,
      details: {
        currentCount: params.currentCount,
        limit: params.limit,
        timeWindowSeconds: params.timeWindowSeconds,
        remaining: params.remaining,
        wouldExceed,
      },
    });
  } else {
    recordDeliveryPreviewForArticle(params.articleIdHash, {
      stage: DeliveryPreviewStage.MediumRateLimit,
      status,
      details: {
        mediumId: params.mediumId || "",
        currentCount: params.currentCount,
        limit: params.limit,
        timeWindowSeconds: params.timeWindowSeconds,
        remaining: params.remaining,
        wouldExceed,
      },
    });
  }
}

export function recordMediumFilterDiagnostic(
  params: MediumFilterDiagnosticParams
): void {
  if (!isDeliveryPreviewMode()) {
    return;
  }

  recordDeliveryPreviewForArticle(params.articleIdHash, {
    stage: DeliveryPreviewStage.MediumFilter,
    status: params.filterResult ? DeliveryPreviewStageStatus.Passed : DeliveryPreviewStageStatus.Failed,
    details: {
      mediumId: params.mediumId,
      filterExpression: params.filterExpression,
      filterResult: params.filterResult,
      explainBlocked: params.explainBlocked,
      explainMatched: params.explainMatched,
    },
  });
}

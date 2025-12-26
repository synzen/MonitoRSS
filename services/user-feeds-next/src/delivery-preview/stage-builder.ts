import {
  CANONICAL_STAGES,
  DeliveryPreviewStage,
  DeliveryPreviewStageStatus,
  type DeliveryPreviewStageResult,
  type SkippedDeliveryPreviewResult,
} from "./types";

/**
 * Build a complete stage list with skipped stages filled in.
 * Stages are returned in canonical order.
 */
export function buildCompleteStageList(
  runStages: DeliveryPreviewStageResult[],
  canonicalStages: DeliveryPreviewStage[] = CANONICAL_STAGES
): DeliveryPreviewStageResult[] {
  const runStageMap = new Map(runStages.map((s) => [s.stage, s]));

  return canonicalStages.map((stageId) => {
    const existingStage = runStageMap.get(stageId);

    if (existingStage) {
      return existingStage;
    }

    // This stage was skipped - create a skipped entry
    const skippedStage: SkippedDeliveryPreviewResult = {
      stage: stageId,
      status: DeliveryPreviewStageStatus.Skipped,
      details: null,
    };

    return skippedStage;
  });
}

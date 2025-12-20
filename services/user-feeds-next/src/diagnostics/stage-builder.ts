import {
  CANONICAL_STAGES,
  DiagnosticStage,
  DiagnosticStageStatus,
  type DiagnosticStageResult,
  type SkippedDiagnosticResult,
} from "./types";

/**
 * Build a complete stage list with skipped stages filled in.
 * Stages are returned in canonical order.
 */
export function buildCompleteStageList(
  runStages: DiagnosticStageResult[],
  canonicalStages: DiagnosticStage[] = CANONICAL_STAGES
): DiagnosticStageResult[] {
  const runStageMap = new Map(runStages.map((s) => [s.stage, s]));

  return canonicalStages.map((stageId) => {
    const existingStage = runStageMap.get(stageId);

    if (existingStage) {
      return existingStage;
    }

    // This stage was skipped - create a skipped entry
    const skippedStage: SkippedDiagnosticResult = {
      stage: stageId,
      status: DiagnosticStageStatus.Skipped,
      details: null,
    };

    return skippedStage;
  });
}

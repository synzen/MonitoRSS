import { AsyncLocalStorage } from "node:async_hooks";
import { DeliveryPreviewStage, DeliveryPreviewStageStatus, type DeliveryPreviewStageResult } from "./types";

interface DeliveryPreviewStore {
  enabled: boolean;
  targetArticleIdHashes: Set<string>;
  stagesByArticle: Map<string, DeliveryPreviewStageResult[]>;
}

const deliveryPreviewStorage = new AsyncLocalStorage<DeliveryPreviewStore>();

/**
 * Start a delivery preview context for analyzing articles.
 * Accepts either a single hash (string) or multiple hashes (Set<string>).
 * All delivery preview recordings within the callback will be captured.
 */
export function startDeliveryPreviewContext<T>(
  targetArticleIdHashes: string | Set<string>,
  cb: () => Promise<T>
): Promise<T> {
  const hashSet =
    typeof targetArticleIdHashes === "string"
      ? new Set([targetArticleIdHashes])
      : targetArticleIdHashes;

  return deliveryPreviewStorage.run(
    {
      enabled: true,
      targetArticleIdHashes: hashSet,
      stagesByArticle: new Map(),
    },
    cb
  );
}

/**
 * End the current delivery preview context early.
 * Subsequent delivery preview recordings will be no-ops.
 */
export function endDeliveryPreviewEarly(): void {
  const store = deliveryPreviewStorage.getStore();
  if (store) {
    store.enabled = false;
  }
}

/**
 * Check if currently running inside a delivery preview context.
 */
export function isDeliveryPreviewMode(): boolean {
  const store = deliveryPreviewStorage.getStore();
  return store?.enabled ?? false;
}

/**
 * Get the target article ID hash for the current delivery preview context.
 * Returns the first hash if multiple are set (for backward compatibility).
 * Returns null if not in delivery preview mode.
 */
export function getTargetArticleIdHash(): string | null {
  const store = deliveryPreviewStorage.getStore();
  if (!store?.targetArticleIdHashes) return null;
  const firstHash = store.targetArticleIdHashes.values().next().value;
  return firstHash ?? null;
}

/**
 * Clear the delivery preview context (mainly for testing).
 * Note: AsyncLocalStorage contexts are automatically cleaned up,
 * so this is a no-op in production scenarios.
 */
export function clearDeliveryPreviewContext(): void {
  // AsyncLocalStorage handles cleanup automatically when context exits.
  // This function exists primarily for test setup/teardown symmetry.
}

/**
 * Record a delivery preview stage result for a specific article hash.
 * Does nothing if not in delivery preview mode or if the hash is not a target.
 */
export function recordDeliveryPreviewForArticle(
  hash: string,
  stage: DeliveryPreviewStageResult
): void {
  const store = deliveryPreviewStorage.getStore();
  if (!store?.enabled || !store.targetArticleIdHashes.has(hash)) {
    return;
  }

  let stages = store.stagesByArticle.get(hash);
  if (!stages) {
    stages = [];
    store.stagesByArticle.set(hash, stages);
  }

  // Stages that block ALL further recording when failed (truly terminal failures)
  const TERMINAL_BLOCKING_STAGES = new Set([
    DeliveryPreviewStage.FeedState,
    DeliveryPreviewStage.BlockingComparison,
    DeliveryPreviewStage.DateCheck,
    DeliveryPreviewStage.FeedRateLimit,
  ]);

  // Check if we have a terminal failure that blocks everything
  if (stages.some((s) => s.status === DeliveryPreviewStageStatus.Failed && TERMINAL_BLOCKING_STAGES.has(s.stage))) {
    return;
  }

  // IdComparison failure only blocks if we're not recording PassingComparison
  // (PassingComparison is specifically for seen articles where IdComparison failed)
  const hasIdComparisonFailed = stages.some(
    (s) => s.stage === DeliveryPreviewStage.IdComparison && s.status === DeliveryPreviewStageStatus.Failed
  );
  if (hasIdComparisonFailed && stage.stage !== DeliveryPreviewStage.PassingComparison) {
    return;
  }

  stages.push(stage);
}

/**
 * Get delivery preview results for a specific article hash.
 * Returns empty array if not in delivery preview mode or if no results for that hash.
 */
export function getDeliveryPreviewResultsForArticle(
  hash: string
): DeliveryPreviewStageResult[] {
  const store = deliveryPreviewStorage.getStore();
  return store?.stagesByArticle?.get(hash) ?? [];
}

/**
 * Get all delivery preview results from the current context as a Map.
 * Returns empty Map if not in delivery preview mode.
 */
export function getAllDeliveryPreviewResults(): Map<string, DeliveryPreviewStageResult[]> {
  const store = deliveryPreviewStorage.getStore();
  return store?.stagesByArticle ?? new Map();
}

/**
 * Iterate only over target article hashes and record delivery previews.
 * O(T) where T = number of target hashes (typically 1), instead of O(N) for all articles.
 * Does nothing if not in delivery preview mode.
 * Callback can return null to skip recording for that article.
 */
export function recordDeliveryPreviewForTargetArticles<T>(
  articleMap: Map<string, T>,
  cb: (article: T, hash: string) => DeliveryPreviewStageResult | null
): void {
  const store = deliveryPreviewStorage.getStore();
  if (!store?.enabled) return;

  for (const hash of store.targetArticleIdHashes) {
    const article = articleMap.get(hash);
    if (article) {
      const result = cb(article, hash);
      if (result) {
        recordDeliveryPreviewForArticle(hash, result);
      }
    }
  }
}

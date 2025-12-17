import { AsyncLocalStorage } from "node:async_hooks";
import type { DiagnosticStageResult } from "./types";

interface DiagnosticStore {
  enabled: boolean;
  targetArticleIdHashes: Set<string>;
  stagesByArticle: Map<string, DiagnosticStageResult[]>;
}

const diagnosticStorage = new AsyncLocalStorage<DiagnosticStore>();

/**
 * Start a diagnostic context for analyzing articles.
 * Accepts either a single hash (string) or multiple hashes (Set<string>).
 * All diagnostic recordings within the callback will be captured.
 */
export function startDiagnosticContext<T>(
  targetArticleIdHashes: string | Set<string>,
  cb: () => Promise<T>
): Promise<T> {
  const hashSet =
    typeof targetArticleIdHashes === "string"
      ? new Set([targetArticleIdHashes])
      : targetArticleIdHashes;

  return diagnosticStorage.run(
    {
      enabled: true,
      targetArticleIdHashes: hashSet,
      stagesByArticle: new Map(),
    },
    cb
  );
}

/**
 * Check if currently running inside a diagnostic context.
 */
export function isDiagnosticMode(): boolean {
  const store = diagnosticStorage.getStore();
  return store?.enabled ?? false;
}

/**
 * Get the target article ID hash for the current diagnostic context.
 * Returns the first hash if multiple are set (for backward compatibility).
 * Returns null if not in diagnostic mode.
 */
export function getTargetArticleIdHash(): string | null {
  const store = diagnosticStorage.getStore();
  if (!store?.targetArticleIdHashes) return null;
  const firstHash = store.targetArticleIdHashes.values().next().value;
  return firstHash ?? null;
}

/**
 * Clear the diagnostic context (mainly for testing).
 * Note: AsyncLocalStorage contexts are automatically cleaned up,
 * so this is a no-op in production scenarios.
 */
export function clearDiagnosticContext(): void {
  // AsyncLocalStorage handles cleanup automatically when context exits.
  // This function exists primarily for test setup/teardown symmetry.
}

/**
 * Record a diagnostic stage result for a specific article hash.
 * Does nothing if not in diagnostic mode or if the hash is not a target.
 */
export function recordDiagnosticForArticle(
  hash: string,
  stage: DiagnosticStageResult
): void {
  const store = diagnosticStorage.getStore();
  if (!store?.enabled || !store.targetArticleIdHashes.has(hash)) {
    return;
  }

  let stages = store.stagesByArticle.get(hash);
  if (!stages) {
    stages = [];
    store.stagesByArticle.set(hash, stages);
  }
  stages.push(stage);
}

/**
 * Get diagnostic results for a specific article hash.
 * Returns empty array if not in diagnostic mode or if no results for that hash.
 */
export function getDiagnosticResultsForArticle(
  hash: string
): DiagnosticStageResult[] {
  const store = diagnosticStorage.getStore();
  return store?.stagesByArticle?.get(hash) ?? [];
}

/**
 * Get all diagnostic results from the current context as a Map.
 * Returns empty Map if not in diagnostic mode.
 */
export function getAllDiagnosticResults(): Map<string, DiagnosticStageResult[]> {
  const store = diagnosticStorage.getStore();
  return store?.stagesByArticle ?? new Map();
}

/**
 * Iterate only over target article hashes and record diagnostics.
 * O(T) where T = number of target hashes (typically 1), instead of O(N) for all articles.
 * Does nothing if not in diagnostic mode.
 * Callback can return null to skip recording for that article.
 */
export function recordDiagnosticForTargetArticles<T>(
  articleMap: Map<string, T>,
  cb: (article: T, hash: string) => DiagnosticStageResult | null
): void {
  const store = diagnosticStorage.getStore();
  if (!store?.enabled) return;

  for (const hash of store.targetArticleIdHashes) {
    const article = articleMap.get(hash);
    if (article) {
      const result = cb(article, hash);
      if (result) {
        recordDiagnosticForArticle(hash, result);
      }
    }
  }
}

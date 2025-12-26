import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "crypto";
import dayjs from "dayjs";
import type { Article } from "../parser";
import {
  recordDeliveryPreviewForTargetArticles,
  DeliveryPreviewStage,
  DeliveryPreviewStageStatus,
  endDeliveryPreviewEarly,
} from "../../delivery-preview";

const sha1 = createHash("sha1");

/**
 * Pending insert for article field storage.
 * Used for batching inserts within a request context.
 */
export interface PendingArticleFieldInsert {
  feedId: string;
  fieldName: string;
  hashedValue: string;
  createdAt: Date;
}

/**
 * AsyncLocalStorage store for batching article field inserts.
 */
interface ArticleFieldAsyncStore {
  pendingInserts: PendingArticleFieldInsert[];
}

const articleFieldAsyncStorage =
  new AsyncLocalStorage<ArticleFieldAsyncStore>();

export interface DateCheckOptions {
  oldArticleDateDiffMsThreshold?: number;
  datePlaceholderReferences?: string[];
}

const DEFAULT_DATE_PLACEHOLDERS = ["date", "pubdate"];

export interface ArticleComparisonResult {
  articlesToDeliver: Article[];
  articlesBlocked: Article[];
  articlesPassed: Article[];
}

// ============================================================================
// Stubbed Storage Interface
// In production, this would be backed by PostgreSQL
// ============================================================================

export interface ArticleFieldStore {
  /**
   * Check if a feed has any prior articles stored.
   */
  hasPriorArticlesStored(feedId: string): Promise<boolean>;

  /**
   * Find which article ID hashes are already stored for a feed.
   */
  findStoredArticleIds(
    feedId: string,
    idHashes: string[]
  ): Promise<Set<string>>;

  /**
   * Find which article ID hashes are stored, partitioned by age.
   * Used for two-pass filtering optimization:
   * - olderThanOneMonth=false: returns IDs stored within the past month ("hot" partition)
   * - olderThanOneMonth=true: returns IDs stored older than one month ("cold" partition)
   *
   * This allows efficient lookups when backed by a partitioned PostgreSQL table.
   */
  findStoredArticleIdsPartitioned(
    feedId: string,
    idHashes: string[],
    olderThanOneMonth: boolean
  ): Promise<Set<string>>;

  /**
   * Check if any of the given field+value combinations exist for a feed.
   */
  someFieldsExist(
    feedId: string,
    fields: Array<{ name: string; hashedValue: string }>
  ): Promise<boolean>;

  /**
   * Store article ID hashes and comparison field values.
   */
  storeArticles(
    feedId: string,
    articles: Article[],
    comparisonFields: string[]
  ): Promise<void>;

  /**
   * Get which comparison field names have been stored for a feed.
   * This tracks which fields have ever had values stored, not the values themselves.
   * Used to determine if a comparison field is "active" for blocking/passing checks.
   */
  getStoredComparisonNames(feedId: string): Promise<Set<string>>;

  /**
   * Store comparison field names as "active" for a feed.
   * Called when new comparison fields are first used.
   */
  storeComparisonNames(
    feedId: string,
    comparisonFields: string[]
  ): Promise<void>;

  /**
   * Clear all stored data for a feed.
   */
  clear(feedId: string): Promise<void>;

  /**
   * Start a context for batching inserts.
   * All storeArticles calls within the callback will be batched
   * and not persisted until flushPendingInserts is called.
   */
  startContext<T>(cb: () => Promise<T>): Promise<T>;

  /**
   * Flush all pending inserts accumulated within the current context.
   * Must be called within a startContext callback.
   * @returns The number of rows affected.
   */
  flushPendingInserts(): Promise<{ affectedRows: number }>;
}

// ============================================================================
// In-Memory Store (Stub for development/testing)
// ============================================================================

interface StoredField {
  feedId: string;
  fieldName: string;
  hashedValue: string;
  createdAt: Date;
}

const inMemoryStore: StoredField[] = [];

/**
 * Tracks which comparison field names have been stored per feed.
 * Separate from inMemoryStore since this tracks field names, not field values.
 */
const inMemoryComparisonNames: Map<string, Set<string>> = new Map();

export const inMemoryArticleFieldStore: ArticleFieldStore = {
  async hasPriorArticlesStored(feedId: string): Promise<boolean> {
    return inMemoryStore.some(
      (f) => f.feedId === feedId && f.fieldName === "id"
    );
  },

  async findStoredArticleIds(
    feedId: string,
    idHashes: string[]
  ): Promise<Set<string>> {
    const found = new Set<string>();
    for (const hash of idHashes) {
      const exists = inMemoryStore.some(
        (f) =>
          f.feedId === feedId && f.fieldName === "id" && f.hashedValue === hash
      );
      if (exists) {
        found.add(hash);
      }
    }
    return found;
  },

  async findStoredArticleIdsPartitioned(
    feedId: string,
    idHashes: string[],
    olderThanOneMonth: boolean
  ): Promise<Set<string>> {
    const oneMonthAgo = dayjs().subtract(1, "month").toDate();
    const found = new Set<string>();

    for (const hash of idHashes) {
      const entry = inMemoryStore.find(
        (f) =>
          f.feedId === feedId && f.fieldName === "id" && f.hashedValue === hash
      );

      if (entry) {
        const isOlderThanOneMonth = entry.createdAt <= oneMonthAgo;
        if (olderThanOneMonth === isOlderThanOneMonth) {
          found.add(hash);
        }
      }
    }

    return found;
  },

  async someFieldsExist(
    feedId: string,
    fields: Array<{ name: string; hashedValue: string }>
  ): Promise<boolean> {
    for (const field of fields) {
      const exists = inMemoryStore.some(
        (f) =>
          f.feedId === feedId &&
          f.fieldName === field.name &&
          f.hashedValue === field.hashedValue
      );
      if (exists) {
        return true;
      }
    }
    return false;
  },

  async storeArticles(
    feedId: string,
    articles: Article[],
    comparisonFields: string[]
  ): Promise<void> {
    const now = new Date();
    const asyncStore = articleFieldAsyncStorage.getStore();

    if (!asyncStore) {
      throw new Error(
        "No context was started for ArticleFieldStore. " +
          "Call storeArticles within a startContext callback."
      );
    }

    const { pendingInserts } = asyncStore;

    for (const article of articles) {
      // Store article ID
      pendingInserts.push({
        feedId,
        fieldName: "id",
        hashedValue: article.flattened.idHash,
        createdAt: now,
      });

      // Store comparison fields
      for (const fieldName of comparisonFields) {
        const value = article.flattened[fieldName];
        if (value) {
          const hashedValue = sha1.copy().update(value).digest("hex");
          pendingInserts.push({
            feedId,
            fieldName,
            hashedValue,
            createdAt: now,
          });
        }
      }
    }
  },

  async clear(feedId: string): Promise<void> {
    // Remove all entries for this feed
    let i = inMemoryStore.length;
    while (i--) {
      if (inMemoryStore[i]!.feedId === feedId) {
        inMemoryStore.splice(i, 1);
      }
    }
    // Also clear comparison names
    inMemoryComparisonNames.delete(feedId);
  },

  async getStoredComparisonNames(feedId: string): Promise<Set<string>> {
    return inMemoryComparisonNames.get(feedId) ?? new Set();
  },

  async storeComparisonNames(
    feedId: string,
    comparisonFields: string[]
  ): Promise<void> {
    let stored = inMemoryComparisonNames.get(feedId);
    if (!stored) {
      stored = new Set();
      inMemoryComparisonNames.set(feedId, stored);
    }
    for (const field of comparisonFields) {
      stored.add(field);
    }
  },

  async startContext<T>(cb: () => Promise<T>): Promise<T> {
    return articleFieldAsyncStorage.run({ pendingInserts: [] }, cb);
  },

  async flushPendingInserts(): Promise<{ affectedRows: number }> {
    const asyncStore = articleFieldAsyncStorage.getStore();

    if (!asyncStore) {
      throw new Error("No context was started for ArticleFieldStore");
    }

    const { pendingInserts } = asyncStore;

    if (pendingInserts.length === 0) {
      return { affectedRows: 0 };
    }

    // Move all pending inserts to the actual store
    for (const insert of pendingInserts) {
      inMemoryStore.push(insert);
    }

    const affectedRows = pendingInserts.length;
    asyncStore.pendingInserts = []; // Clear the buffer

    return { affectedRows };
  },
};

// ============================================================================
// Article Comparison Logic
// ============================================================================

/**
 * Hash a field value using SHA1.
 */
function hashFieldValue(value: string): string {
  return sha1.copy().update(value).digest("hex");
}

/**
 * Check if any of the comparison fields for an article have been seen before.
 */
async function articleFieldsSeenBefore(
  store: ArticleFieldStore,
  feedId: string,
  article: Article,
  fieldKeys: string[]
): Promise<boolean> {
  const queries: Array<{ name: string; hashedValue: string }> = [];

  for (const key of fieldKeys) {
    const value = article.flattened[key];
    if (value) {
      queries.push({ name: key, hashedValue: hashFieldValue(value) });
    }
  }

  if (queries.length === 0) {
    return false;
  }

  return store.someFieldsExist(feedId, queries);
}

/**
 * Result of two-pass filtering for new articles.
 */
interface FilterForNewArticlesResult {
  /** Articles that have never been stored (truly new) */
  newArticles: Article[];
  /**
   * Articles that were stored older than one month ago.
   * These should be re-stored with current timestamp for efficient future lookups.
   */
  articlesToRestore: Article[];
}

/**
 * Filter articles that have not been seen before (by ID).
 *
 * Uses two-pass partitioned lookup for efficiency:
 * 1. First pass: Check "hot" partition (stored within past month)
 * 2. Second pass: For candidates, check "cold" partition (older than 1 month)
 *
 * Articles found in cold partition are returned for re-storing with fresh timestamp.
 *
 * Example:
 *   Feed has articles a, b, c where:
 *   - a: stored 5 months ago (cold partition)
 *   - b: stored 10 days ago (hot partition)
 *   - c: never stored
 *
 *   First pass returns b → candidates are a, c
 *   Second pass returns a → articlesToRestore = [a]
 *   Final result: newArticles = [c], articlesToRestore = [a]
 */
async function filterForNewArticles(
  store: ArticleFieldStore,
  feedId: string,
  articles: Article[]
): Promise<FilterForNewArticlesResult> {
  const articleMap = new Map(
    articles.map((article) => [article.flattened.idHash, article])
  );
  const idHashes = Array.from(articleMap.keys());

  // FIRST PASS: Find articles stored within the past month (hot partition)
  const idsStoredInPastMonth = await store.findStoredArticleIdsPartitioned(
    feedId,
    idHashes,
    false // NOT older than one month = stored within past month
  );

  // Filter to get candidates (articles NOT in past month)
  const candidateIds = idHashes.filter((id) => !idsStoredInPastMonth.has(id));

  if (candidateIds.length === 0) {
    // All articles were stored within past month - nothing new
    return { newArticles: [], articlesToRestore: [] };
  }

  // SECOND PASS: From candidates, find any stored older than one month (cold partition)
  const idsStoredOlderThanOneMonth =
    await store.findStoredArticleIdsPartitioned(
      feedId,
      candidateIds,
      true // older than one month
    );

  // These old articles need to be re-stored with current timestamp
  const articlesToRestore = Array.from(idsStoredOlderThanOneMonth)
    .map((id) => articleMap.get(id))
    .filter((a): a is Article => a !== undefined);

  // Combine both sets to get all stored IDs
  const allStoredIds = new Set([
    ...idsStoredInPastMonth,
    ...idsStoredOlderThanOneMonth,
  ]);

  // New articles are those not in either set
  const newArticles = idHashes
    .filter((id) => !allStoredIds.has(id))
    .map((id) => articleMap.get(id)!);

  return { newArticles, articlesToRestore };
}

/**
 * Check blocking comparisons on NEW articles.
 * Block if ANY comparison field was seen before.
 */
async function checkBlockingComparisons(
  store: ArticleFieldStore,
  feedId: string,
  blockingComparisons: string[],
  newArticles: Article[]
): Promise<Article[]> {
  if (blockingComparisons.length === 0) {
    return newArticles;
  }

  const results = await Promise.all(
    newArticles.map(async (article) => {
      const shouldBlock = await articleFieldsSeenBefore(
        store,
        feedId,
        article,
        blockingComparisons
      );
      return shouldBlock ? null : article;
    })
  );

  return results.filter((article): article is Article => article !== null);
}

/**
 * Check passing comparisons on SEEN articles.
 * Pass if ANY comparison field has NOT been seen before.
 */
async function checkPassingComparisons(
  store: ArticleFieldStore,
  feedId: string,
  passingComparisons: string[],
  seenArticles: Article[]
): Promise<Article[]> {
  if (passingComparisons.length === 0) {
    return [];
  }

  const results = await Promise.all(
    seenArticles.map(async (article) => {
      const allFieldsSeen = await articleFieldsSeenBefore(
        store,
        feedId,
        article,
        passingComparisons
      );
      // Pass if NOT all fields seen (i.e., something changed)
      return allFieldsSeen ? null : article;
    })
  );

  return results.filter((article): article is Article => article !== null);
}

interface ArticleDateCheckInfo {
  articleDate: string | null;
  ageMs: number | null;
  passes: boolean;
}

function getArticleDateCheckInfo(
  article: Article,
  threshold: number,
  placeholders: string[]
): ArticleDateCheckInfo {
  for (const placeholder of placeholders) {
    const raw = article.raw[placeholder as keyof typeof article.raw];
    if (raw) {
      const parsed = dayjs(raw);
      if (parsed.isValid()) {
        const ageMs = dayjs().diff(parsed, "millisecond");
        const passes = ageMs < 0 || ageMs <= threshold;
        return { articleDate: raw, ageMs, passes };
      }
    }
  }
  return { articleDate: null, ageMs: null, passes: true };
}

function filterArticlesBasedOnDateChecks(
  articles: Article[],
  dateChecks?: DateCheckOptions
): Article[] {
  if (!dateChecks?.oldArticleDateDiffMsThreshold) {
    return articles;
  }

  const threshold = dateChecks.oldArticleDateDiffMsThreshold;
  const placeholders =
    dateChecks.datePlaceholderReferences || DEFAULT_DATE_PLACEHOLDERS;

  return articles.filter((article) => {
    const { passes } = getArticleDateCheckInfo(article, threshold, placeholders);
    return passes;
  });
}

/**
 * Main function to get articles to deliver.
 */
export async function getArticlesToDeliver(
  store: ArticleFieldStore,
  feedId: string,
  articles: Article[],
  options: {
    blockingComparisons: string[];
    passingComparisons: string[];
    dateChecks?: DateCheckOptions;
  }
): Promise<ArticleComparisonResult> {
  const { blockingComparisons, passingComparisons, dateChecks } = options;

  // Lazy article map creation - only created when in diagnostic mode
  let articleMap: Map<string, (typeof articles)[number]> | null = null;
  function getArticleMap() {
    if (!articleMap) {
      articleMap = new Map(articles.map((a) => [a.flattened.idHash, a]));
    }
    return articleMap;
  }

  // Check if we have prior articles stored
  const hasPriorArticles = await store.hasPriorArticlesStored(feedId);

  if (!hasPriorArticles) {
    // Record delivery preview for first run - O(T) where T = target articles
    recordDeliveryPreviewForTargetArticles(getArticleMap(), () => ({
      stage: DeliveryPreviewStage.FeedState,
      status: DeliveryPreviewStageStatus.Failed,
      details: {
        hasPriorArticles: false,
        isFirstRun: true,
        storedComparisonNames: [],
      },
    }));

    // First run - store all articles, deliver nothing
    await store.storeArticles(feedId, articles, [
      ...blockingComparisons,
      ...passingComparisons,
    ]);
    // Store comparison field names as "active"
    await store.storeComparisonNames(feedId, [
      ...blockingComparisons,
      ...passingComparisons,
    ]);
    return {
      articlesToDeliver: [],
      articlesBlocked: [],
      articlesPassed: [],
    };
  }

  // Get which comparison field names are "active" (already stored)
  // Only comparisons that have been stored before will be used for blocking/passing
  const storedComparisonNames = await store.getStoredComparisonNames(feedId);

  // Record FeedState delivery preview for non-first-run case - O(T)
  recordDeliveryPreviewForTargetArticles(getArticleMap(), () => ({
    stage: DeliveryPreviewStage.FeedState,
    status: DeliveryPreviewStageStatus.Passed,
    details: {
      hasPriorArticles: true,
      isFirstRun: false,
      storedComparisonNames: Array.from(storedComparisonNames),
    },
  }));

  const activeBlockingComparisons = blockingComparisons.filter((name) =>
    storedComparisonNames.has(name)
  );
  const activePassingComparisons = passingComparisons.filter((name) =>
    storedComparisonNames.has(name)
  );

  // Find comparisons that are NOT yet stored (newly added by user)
  const allComparisons = [...blockingComparisons, ...passingComparisons];
  const unstoredComparisons = allComparisons.filter(
    (name) => !storedComparisonNames.has(name)
  );

  // Filter for new articles by ID (two-pass partitioned lookup)
  const { newArticles, articlesToRestore } = await filterForNewArticles(
    store,
    feedId,
    articles
  );

  const newArticleHashes = new Set(newArticles.map((a) => a.flattened.idHash));
  const restoreHashes = new Set(articlesToRestore.map((a) => a.flattened.idHash));

  // Get seen articles (existing IDs)
  const seenArticles = articles.filter(
    (a) => !newArticleHashes.has(a.flattened.idHash)
  );

  // Check blocking comparisons on NEW articles (only using active comparisons)
  const articlesPastBlocks = await checkBlockingComparisons(
    store,
    feedId,
    activeBlockingComparisons,
    newArticles
  );

  // Check passing comparisons on SEEN articles (only using active comparisons)
  // Must check BEFORE recording IdComparison so we know if seen articles pass via PassingComparison
  const articlesPassedComparisons = await checkPassingComparisons(
    store,
    feedId,
    activePassingComparisons,
    seenArticles
  );
  const passedViaComparisonHashes = new Set(
    articlesPassedComparisons.map((a) => a.flattened.idHash)
  );

  // Record IdComparison delivery preview - O(T)
  recordDeliveryPreviewForTargetArticles(getArticleMap(), (_, hash) => {
    const isNew = newArticleHashes.has(hash);
    const isRestored = restoreHashes.has(hash);

    return {
      stage: DeliveryPreviewStage.IdComparison,
      status: isNew ? DeliveryPreviewStageStatus.Passed : DeliveryPreviewStageStatus.Failed,
      details: {
        articleIdHash: hash,
        foundInHotPartition: !isNew && !isRestored,
        foundInColdPartition: isRestored,
        isNew,
      },
    };
  });

  // Record BlockingComparison delivery preview for new target articles - O(T)
  if (blockingComparisons.length > 0) {
  const pastBlocksHashes = new Set(articlesPastBlocks.map((a) => a.flattened.idHash));
    recordDeliveryPreviewForTargetArticles(getArticleMap(), (_, hash) => {
      if (!newArticleHashes.has(hash)) return null; // Only record for new articles
      const passed = pastBlocksHashes.has(hash);
      return {
        stage: DeliveryPreviewStage.BlockingComparison,
        status: passed ? DeliveryPreviewStageStatus.Passed : DeliveryPreviewStageStatus.Failed,
        details: {
          comparisonFields: blockingComparisons,
          activeFields: activeBlockingComparisons,
          blockedByFields: passed ? [] : activeBlockingComparisons,
        },
      };
    });
  }

  // Record PassingComparison delivery preview for seen target articles - O(T)
  if (passingComparisons.length > 0) {
    const seenHashes = new Set(seenArticles.map((a) => a.flattened.idHash));

    recordDeliveryPreviewForTargetArticles(getArticleMap(), (_, hash) => {
      if (!seenHashes.has(hash)) return null; // Only record for seen articles
      const passed = passedViaComparisonHashes.has(hash);
      return {
        stage: DeliveryPreviewStage.PassingComparison,
        status: passed ? DeliveryPreviewStageStatus.Passed : DeliveryPreviewStageStatus.Failed,
        details: {
          comparisonFields: passingComparisons,
          activeFields: activePassingComparisons,
          changedFields: passed ? activePassingComparisons : [],
        },
      };
    });
  }

  // Combine and reverse (deliver oldest first)
  const candidateArticles = [
    ...articlesPastBlocks,
    ...articlesPassedComparisons,
  ].reverse();

  // Apply date checks
  const articlesToDeliver = filterArticlesBasedOnDateChecks(
    candidateArticles,
    dateChecks
  );

  // Record DateCheck delivery preview for candidate target articles - O(T)
  if (dateChecks?.oldArticleDateDiffMsThreshold) {
    const candidateHashes = new Set(candidateArticles.map((a) => a.flattened.idHash));
    const placeholders =
      dateChecks.datePlaceholderReferences || DEFAULT_DATE_PLACEHOLDERS;
    const threshold = dateChecks.oldArticleDateDiffMsThreshold;

    recordDeliveryPreviewForTargetArticles(getArticleMap(), (article, hash) => {
      if (!candidateHashes.has(hash)) return null; // Only record for candidates

      const { articleDate, ageMs, passes } = getArticleDateCheckInfo(
        article,
        threshold,
        placeholders
      );

      return {
        stage: DeliveryPreviewStage.DateCheck,
        status: passes ? DeliveryPreviewStageStatus.Passed : DeliveryPreviewStageStatus.Failed,
        details: {
          articleDate,
          threshold,
          datePlaceholders: placeholders,
          ageMs,
          withinThreshold: passes,
        },
      };
    });
  }

  // Store new articles
  if (newArticles.length > 0) {
    await store.storeArticles(feedId, newArticles, [
      ...blockingComparisons,
      ...passingComparisons,
    ]);
    // Also store new comparison field names as "active"
    await store.storeComparisonNames(feedId, [
      ...blockingComparisons,
      ...passingComparisons,
    ]);
  }

  // Re-store articles from cold partition with fresh timestamp.
  // This moves them to the hot partition for efficient future lookups.
  // Only IDs are re-stored, not comparison fields (matching user-feeds behavior).
  if (articlesToRestore.length > 0) {
    await store.storeArticles(feedId, articlesToRestore, []);
  }

  // Store passed comparison fields for seen articles
  if (articlesPassedComparisons.length > 0) {
    await store.storeArticles(
      feedId,
      articlesPassedComparisons,
      passingComparisons
    );
  }

  // Store comparison field values for ALL articles when there are new (unstored) comparisons.
  // This ensures that when a user adds a new comparison field, ALL current articles get
  // their field values stored so blocking/passing can work on the next run.
  // Skip ID storage since IDs are already stored.
  if (unstoredComparisons.length > 0) {
    await store.storeArticles(feedId, articles, unstoredComparisons);
    await store.storeComparisonNames(feedId, unstoredComparisons);
  }

  return {
    articlesToDeliver,
    articlesBlocked: newArticles.filter((a) => !articlesPastBlocks.includes(a)),
    articlesPassed: articlesPassedComparisons,
  };
}

/**
 * Clear the in-memory store (for testing).
 */
export function clearInMemoryStore(): void {
  inMemoryStore.length = 0;
  inMemoryComparisonNames.clear();
}

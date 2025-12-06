import { createHash } from "crypto";
import dayjs from "dayjs";
import type { Article } from "../article-parser";

const sha1 = createHash("sha1");

export interface DateCheckOptions {
  oldArticleDateDiffMsThreshold?: number;
  datePlaceholderReferences?: string[];
}

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
    for (const article of articles) {
      // Store article ID
      inMemoryStore.push({
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
          inMemoryStore.push({
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

/**
 * Filter articles based on date checks.
 */
function filterArticlesBasedOnDateChecks(
  articles: Article[],
  dateChecks?: DateCheckOptions
): Article[] {
  if (!dateChecks?.oldArticleDateDiffMsThreshold) {
    return articles;
  }

  const threshold = dateChecks.oldArticleDateDiffMsThreshold;
  const placeholders = dateChecks.datePlaceholderReferences || [
    "date",
    "pubdate",
  ];

  return articles.filter((article) => {
    // Try to find a valid date from the configured placeholders
    const dateValue = placeholders
      .map((placeholder) => {
        const raw = article.raw[placeholder as keyof typeof article.raw];
        return dayjs(raw || "invalid date");
      })
      .find((d) => d.isValid());

    if (!dateValue) {
      // No valid date found, deliver anyway
      return true;
    }

    const diffMs = dayjs().diff(dateValue, "millisecond");

    // Pass if: in the future OR within threshold
    return diffMs < 0 || diffMs <= threshold;
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

  // Check if we have prior articles stored
  const hasPriorArticles = await store.hasPriorArticlesStored(feedId);

  if (!hasPriorArticles) {
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
  const activeBlockingComparisons = blockingComparisons.filter((name) =>
    storedComparisonNames.has(name)
  );
  const activePassingComparisons = passingComparisons.filter((name) =>
    storedComparisonNames.has(name)
  );

  // Filter for new articles by ID (two-pass partitioned lookup)
  const { newArticles, articlesToRestore } = await filterForNewArticles(
    store,
    feedId,
    articles
  );

  // Get seen articles (existing IDs)
  const newArticleHashes = new Set(newArticles.map((a) => a.flattened.idHash));
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
  const articlesPassedComparisons = await checkPassingComparisons(
    store,
    feedId,
    activePassingComparisons,
    seenArticles
  );

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

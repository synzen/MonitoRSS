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
 * Filter articles that have not been seen before (by ID).
 */
async function filterForNewArticles(
  store: ArticleFieldStore,
  feedId: string,
  articles: Article[]
): Promise<Article[]> {
  const articleMap = new Map(
    articles.map((article) => [article.flattened.idHash, article])
  );
  const idHashes = Array.from(articleMap.keys());

  const storedIds = await store.findStoredArticleIds(feedId, idHashes);

  return idHashes
    .filter((hash) => !storedIds.has(hash))
    .map((hash) => articleMap.get(hash)!);
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
    return {
      articlesToDeliver: [],
      articlesBlocked: [],
      articlesPassed: [],
    };
  }

  // Filter for new articles by ID
  const newArticles = await filterForNewArticles(store, feedId, articles);

  // Get seen articles (existing IDs)
  const newArticleHashes = new Set(newArticles.map((a) => a.flattened.idHash));
  const seenArticles = articles.filter(
    (a) => !newArticleHashes.has(a.flattened.idHash)
  );

  // Check blocking comparisons on NEW articles
  const articlesPastBlocks = await checkBlockingComparisons(
    store,
    feedId,
    blockingComparisons,
    newArticles
  );

  // Check passing comparisons on SEEN articles
  const articlesPassedComparisons = await checkPassingComparisons(
    store,
    feedId,
    passingComparisons,
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
}

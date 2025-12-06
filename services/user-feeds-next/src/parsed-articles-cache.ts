/**
 * Parsed Articles Cache
 *
 * This module provides caching for parsed feed articles.
 * When articles are parsed from XML, they can be cached to avoid re-parsing
 * on subsequent requests for the same feed URL + options combination.
 *
 * Matches the behavior in user-feeds/src/articles/articles.service.ts
 */

import { deflate, inflate } from "zlib";
import { promisify } from "util";
import { createHash } from "crypto";
import type { Article } from "./article-parser";

const deflatePromise = promisify(deflate);
const inflatePromise = promisify(inflate);
const sha1 = createHash("sha1");

// ============================================================================
// Types
// ============================================================================

export interface FormatOptions {
  dateFormat?: string;
  dateTimezone?: string;
  dateLocale?: string;
  disableImageLinkPreviews?: boolean;
}

export interface ExternalFeedProperty {
  sourceField: string;
  cssSelector: string;
  label: string;
}

export interface RequestLookupDetails {
  key: string;
  url?: string;
  headers?: Record<string, string>;
}

export interface CacheKeyOptions {
  formatOptions: FormatOptions;
  externalFeedProperties?: ExternalFeedProperty[];
  requestLookupDetails?: RequestLookupDetails | null;
}

export interface CachedArticles {
  articles: Article[];
}

/**
 * Interface for the parsed articles cache store.
 * Abstraction layer for different storage backends (in-memory, Redis, etc.)
 */
export interface ParsedArticlesCacheStore {
  /**
   * Check if a key exists in the cache.
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get a value from the cache.
   */
  get(key: string): Promise<string | null>;

  /**
   * Set a value in the cache with expiration.
   */
  set(
    key: string,
    value: string,
    options: {
      expSeconds: number;
      useOldTTL?: boolean;
    }
  ): Promise<void>;

  /**
   * Delete a key from the cache.
   */
  del(key: string): Promise<void>;

  /**
   * Get the TTL of a key (for useOldTTL support).
   * Returns -1 if key doesn't exist or has no TTL.
   */
  ttl(key: string): Promise<number>;

  /**
   * Set expiration on a key.
   */
  expire(key: string, seconds: number): Promise<void>;
}

// ============================================================================
// In-Memory Cache Store (for development/testing)
// ============================================================================

interface InMemoryCacheEntry {
  value: string;
  expiresAt: number;
}

const inMemoryCache: Map<string, InMemoryCacheEntry> = new Map();

export const inMemoryParsedArticlesCacheStore: ParsedArticlesCacheStore = {
  async exists(key: string): Promise<boolean> {
    const entry = inMemoryCache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      inMemoryCache.delete(key);
      return false;
    }

    return true;
  },

  async get(key: string): Promise<string | null> {
    const entry = inMemoryCache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      inMemoryCache.delete(key);
      return null;
    }

    return entry.value;
  },

  async set(
    key: string,
    value: string,
    options: { expSeconds: number; useOldTTL?: boolean }
  ): Promise<void> {
    let expSeconds = options.expSeconds;

    if (options.useOldTTL) {
      const existingTTL = await this.ttl(key);
      if (existingTTL > 0) {
        expSeconds = existingTTL;
      }
    }

    inMemoryCache.set(key, {
      value,
      expiresAt: Date.now() + expSeconds * 1000,
    });
  },

  async del(key: string): Promise<void> {
    inMemoryCache.delete(key);
  },

  async ttl(key: string): Promise<number> {
    const entry = inMemoryCache.get(key);
    if (!entry) return -1;

    const remaining = Math.floor((entry.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -1;
  },

  async expire(key: string, seconds: number): Promise<void> {
    const entry = inMemoryCache.get(key);
    if (!entry) return;

    entry.expiresAt = Date.now() + seconds * 1000;
  },
};

// ============================================================================
// Cache Key Calculation
// ============================================================================

/**
 * Calculate the cache key for articles based on URL and options.
 * Matches the behavior in user-feeds.
 */
export function calculateCacheKeyForArticles(params: {
  url: string;
  options: CacheKeyOptions;
}): string {
  const { url, options } = params;

  const normalizedOptions: Partial<CacheKeyOptions> = {
    formatOptions: {
      dateFormat: options.formatOptions.dateFormat || undefined,
      dateLocale: options.formatOptions.dateLocale || undefined,
      dateTimezone: options.formatOptions.dateTimezone || undefined,
      disableImageLinkPreviews:
        options.formatOptions.disableImageLinkPreviews || undefined,
    },
    externalFeedProperties: options.externalFeedProperties?.length
      ? options.externalFeedProperties
      : undefined,
    requestLookupDetails: options.requestLookupDetails
      ? {
          key: options.requestLookupDetails.key,
        }
      : undefined,
  };

  // Delete format options if every field is undefined
  if (
    Object.keys(normalizedOptions?.formatOptions || {}).every(
      (key) =>
        normalizedOptions?.formatOptions?.[key as keyof FormatOptions] ===
        undefined
    )
  ) {
    delete normalizedOptions?.formatOptions;
  }

  if (!normalizedOptions.externalFeedProperties) {
    delete normalizedOptions.externalFeedProperties;
  }

  return `articles:com:${sha1
    .copy()
    .update(
      JSON.stringify({
        url,
        options: normalizedOptions,
      })
    )
    .digest("hex")}`;
}

// ============================================================================
// Cache Operations
// ============================================================================

const DEFAULT_EXPIRE_SECONDS = 60 * 5; // 5 minutes

/**
 * Check if feed articles exist in the cache.
 */
export async function doFeedArticlesExistInCache(
  store: ParsedArticlesCacheStore,
  params: {
    url: string;
    options: CacheKeyOptions;
  }
): Promise<boolean> {
  const key = calculateCacheKeyForArticles(params);
  return store.exists(key);
}

/**
 * Get feed articles from the cache.
 */
export async function getFeedArticlesFromCache(
  store: ParsedArticlesCacheStore,
  params: {
    url: string;
    options: CacheKeyOptions;
  }
): Promise<CachedArticles | null> {
  const key = calculateCacheKeyForArticles(params);
  const compressedValue = await store.get(key);

  if (!compressedValue) {
    return null;
  }

  try {
    const jsonText = (
      await inflatePromise(Buffer.from(compressedValue, "base64"))
    ).toString();

    return JSON.parse(jsonText) as CachedArticles;
  } catch {
    // Invalid cache entry, treat as cache miss
    return null;
  }
}

/**
 * Set feed articles in the cache.
 */
export async function setFeedArticlesInCache(
  store: ParsedArticlesCacheStore,
  params: {
    url: string;
    options: CacheKeyOptions;
    data: CachedArticles;
  },
  options?: {
    useOldTTL?: boolean;
  }
): Promise<void> {
  const key = calculateCacheKeyForArticles(params);
  const jsonBody = JSON.stringify(params.data);
  const compressed = (await deflatePromise(jsonBody)).toString("base64");

  await store.set(key, compressed, {
    expSeconds: DEFAULT_EXPIRE_SECONDS,
    useOldTTL: options?.useOldTTL,
  });
}

/**
 * Invalidate feed articles cache.
 */
export async function invalidateFeedArticlesCache(
  store: ParsedArticlesCacheStore,
  params: {
    url: string;
    options: CacheKeyOptions;
  }
): Promise<void> {
  const key = calculateCacheKeyForArticles(params);
  await store.del(key);
}

/**
 * Refresh feed articles cache expiration.
 */
export async function refreshFeedArticlesCacheExpiration(
  store: ParsedArticlesCacheStore,
  params: {
    url: string;
    options: CacheKeyOptions;
  }
): Promise<void> {
  const key = calculateCacheKeyForArticles(params);
  await store.expire(key, DEFAULT_EXPIRE_SECONDS);
}

/**
 * Update feed articles in cache if they already exist.
 * This is called after parsing articles to keep cached data fresh.
 * Matches the behavior of updateFeedArticlesInCache in user-feeds.
 */
export async function updateFeedArticlesInCache(
  store: ParsedArticlesCacheStore,
  params: {
    url: string;
    options: CacheKeyOptions;
    articles: Article[];
  }
): Promise<void> {
  const existsInCache = await doFeedArticlesExistInCache(store, {
    url: params.url,
    options: params.options,
  });

  if (!existsInCache) {
    return;
  }

  await setFeedArticlesInCache(
    store,
    {
      url: params.url,
      options: params.options,
      data: {
        articles: params.articles,
      },
    },
    {
      useOldTTL: true,
    }
  );
}

/**
 * Clear the in-memory cache (for testing).
 */
export function clearInMemoryParsedArticlesCache(): void {
  inMemoryCache.clear();
}

import type { Article } from "../../articles/parser";

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

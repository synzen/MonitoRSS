import { deflate, inflate } from "zlib";
import { promisify } from "util";
import { createHash } from "crypto";
import type { Article } from "../articles/parser";
import {
  type ParsedArticlesCacheStore,
  type CacheKeyOptions,
  type CachedArticles,
  type FormatOptions,
} from "./interfaces/parsed-articles-cache";

const deflatePromise = promisify(deflate);
const inflatePromise = promisify(inflate);
const sha1 = createHash("sha1");

const DEFAULT_EXPIRE_SECONDS = 60 * 5;

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
    lightweight: options.lightweight || undefined,
  };

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
    return null;
  }
}

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

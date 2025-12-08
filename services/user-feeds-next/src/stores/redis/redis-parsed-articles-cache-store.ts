import type { ParsedArticlesCacheStore } from "../interfaces/parsed-articles-cache";
import type { RedisClient } from "./redis-client";
import { logger } from "../../shared/utils";

const KEY_PREFIX = "user-feeds:";
const DEFAULT_EXPIRE_SECONDS = 60 * 5; // 5 minutes

/**
 * Generate a Redis key with the standard prefix.
 * Matches user-feeds/src/cache-storage/cache-storage.service.ts:6-8
 */
function generateKey(key: string): string {
  return `${KEY_PREFIX}${key}`;
}

/**
 * Create a Redis-backed implementation of ParsedArticlesCacheStore.
 * Matches the behavior of CacheStorageService in user-feeds.
 *
 * @param redisClient - The Redis client to use
 * @returns A ParsedArticlesCacheStore backed by Redis
 */
export function createRedisParsedArticlesCacheStore(
  redisClient: RedisClient
): ParsedArticlesCacheStore {
  return {
    async exists(key: string): Promise<boolean> {
      try {
        const result = await redisClient.exists(generateKey(key));
        return result === 1;
      } catch (err) {
        logger.error(
          `Failed to check existence of key ${key} in cache storage`,
          {
            err: (err as Error).stack,
          }
        );
        return false;
      }
    },

    async get(key: string): Promise<string | null> {
      try {
        return await redisClient.get(generateKey(key));
      } catch (err) {
        logger.error(
          `Failed to get content with key ${key} from cache storage`,
          {
            err: (err as Error).stack,
          }
        );
        return null;
      }
    },

    async set(
      key: string,
      value: string,
      options: { expSeconds: number; useOldTTL?: boolean }
    ): Promise<void> {
      let ex = options.expSeconds || DEFAULT_EXPIRE_SECONDS;

      // Preserve existing TTL if requested (matches user-feeds behavior)
      if (options.useOldTTL) {
        try {
          const ttl = await redisClient.ttl(generateKey(key));
          if (ttl !== -1 && ttl > 0) {
            ex = ttl;
          }
        } catch (err) {
          logger.error(
            `Failed to get TTL of key ${key} from cache storage`,
            {
              err: (err as Error).stack,
            }
          );
        }
      }

      try {
        await redisClient.set(generateKey(key), value, { EX: ex });
      } catch (err) {
        logger.error(`Failed to set content in cache storage`, {
          err: (err as Error).stack,
        });
      }
    },

    async del(key: string): Promise<void> {
      try {
        await redisClient.del(generateKey(key));
      } catch (err) {
        logger.error(`Failed to delete content from cache storage`, {
          err: (err as Error).stack,
        });
      }
    },

    async ttl(key: string): Promise<number> {
      try {
        return await redisClient.ttl(generateKey(key));
      } catch (err) {
        logger.error(`Failed to get TTL of key ${key} from cache storage`, {
          err: (err as Error).stack,
        });
        return -1;
      }
    },

    async expire(key: string, seconds: number): Promise<void> {
      try {
        await redisClient.expire(generateKey(key), seconds);
      } catch (err) {
        logger.error(`Failed to set expire for key ${key} in cache storage`, {
          err: (err as Error).stack,
        });
      }
    },
  };
}

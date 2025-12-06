import type { RedisClient } from "./redis-client";

const KEY_PREFIX = "user-feeds:";
const DEFAULT_LOCK_EXPIRE_SECONDS = 60 * 5; // 5 minutes

/**
 * Interface for a processing lock.
 * Used to prevent concurrent processing of the same feed.
 */
export interface ProcessingLock {
  /**
   * Attempt to acquire a lock for processing a feed.
   * @param feedId - The feed ID to lock
   * @returns true if the lock was acquired, false if already locked
   */
  acquire(feedId: string): Promise<boolean>;

  /**
   * Release a processing lock for a feed.
   * @param feedId - The feed ID to unlock
   */
  release(feedId: string): Promise<void>;
}

/**
 * Create an in-memory processing lock.
 * Suitable for testing and single-instance deployments.
 */
export function createInMemoryProcessingLock(): ProcessingLock {
  const locks = new Set<string>();

  return {
    async acquire(feedId: string): Promise<boolean> {
      const key = `processing-${feedId}`;
      if (locks.has(key)) {
        return false;
      }
      locks.add(key);
      return true;
    },

    async release(feedId: string): Promise<void> {
      const key = `processing-${feedId}`;
      locks.delete(key);
    },
  };
}

/**
 * Create a Redis-backed processing lock.
 * Uses SET with GET option for atomic check-and-set.
 * Matches the pattern in user-feeds/src/feed-event-handler/feed-event-handler.service.ts:68-97
 */
export function createRedisProcessingLock(
  redisClient: RedisClient
): ProcessingLock {
  return {
    async acquire(feedId: string): Promise<boolean> {
      const key = `${KEY_PREFIX}processing-${feedId}`;

      try {
        // Use SET with GET option for atomic check-and-set
        // Returns the old value if key existed, null if it didn't
        // Matches user-feeds: getOldValue: true in cacheStorageService.set()
        const oldValue = await redisClient.set(key, "1", {
          EX: DEFAULT_LOCK_EXPIRE_SECONDS,
          GET: true,
        });

        // If oldValue is null, the key didn't exist - we acquired the lock
        // If oldValue is not null, someone else has the lock
        return oldValue === null;
      } catch (err) {
        console.error(`Failed to acquire processing lock for feed ${feedId}`, {
          err: (err as Error).stack,
        });
        // On error, assume we didn't get the lock to be safe
        return false;
      }
    },

    async release(feedId: string): Promise<void> {
      const key = `${KEY_PREFIX}processing-${feedId}`;

      try {
        await redisClient.del(key);
      } catch (err) {
        console.error(`Failed to release processing lock for feed ${feedId}`, {
          err: (err as Error).stack,
        });
      }
    },
  };
}

/**
 * Default in-memory processing lock singleton.
 * Used when Redis is not configured.
 */
export const inMemoryProcessingLock = createInMemoryProcessingLock();

import {
  createClient,
  createCluster,
  type RedisClientType,
  type RedisClusterType,
} from 'redis';
import logger from '../utils/logger';

export type CacheClient = RedisClientType | RedisClusterType;

export async function createCacheClient({
  uri,
  disableCluster,
}: {
  uri: string;
  disableCluster: boolean;
}): Promise<CacheClient> {
  const client: CacheClient = disableCluster
    ? createClient({
        url: uri,
      })
    : createCluster({
        rootNodes: [
          {
            url: uri,
          },
        ],
      });

  client.on('error', (err) => {
    logger.error(`Redis client error: ${(err as Error).message}`, {
      stack: err.stack,
    });
  });

  await client.connect();

  logger.info(`Successfully connected to Redis`);

  return client;
}

export interface CacheStorageService {
  closeClient(): Promise<void>;
  generateKey(key: string): string;
  set(params: {
    key: string;
    body: string;
    expSeconds?: number;
    getOldValue?: boolean;
  }): Promise<unknown>;
  setNX(params: {
    key: string;
    body: string;
    expSeconds?: number;
  }): Promise<boolean>;
  del(key: string): Promise<void>;
  increment(
    key: string,
    opts?: {
      expire?: {
        seconds: number;
        mode: 'NX';
      };
    },
  ): Promise<number>;
  decrement(key: string): Promise<number>;
  setFeedHtmlContent(params: { key: string; body: string }): Promise<void>;
  getFeedHtmlContent(params: { key: string }): Promise<string>;
}

export function createCacheStorageService(
  redisClient: CacheClient,
): CacheStorageService {
  return {
    async closeClient() {
      await redisClient.disconnect();
    },

    generateKey(key: string) {
      return `feed-requests:${key}`;
    },

    async set({ key, body, expSeconds, getOldValue }) {
      try {
        return await redisClient.set(this.generateKey(key), body, {
          EX: expSeconds,
          GET: getOldValue ? true : undefined,
        });
      } catch (err) {
        logger.error(`Failed to set content in cache storage`, {
          err: (err as Error).stack,
        });
      }
    },

    async setNX({ key, body, expSeconds }) {
      try {
        const result = await redisClient.set(this.generateKey(key), body, {
          EX: expSeconds,
          NX: true,
        });

        return result === 'OK';
      } catch (err) {
        logger.error(`Failed to setNX content in cache storage`, {
          err: (err as Error).stack,
        });

        return false;
      }
    },

    async del(key) {
      try {
        await redisClient.del(this.generateKey(key));
      } catch (err) {
        logger.error(`Failed to delete content from cache storage`, {
          err: (err as Error).stack,
        });
      }
    },

    async increment(key, opts) {
      const useKey = this.generateKey(key);

      const multi = redisClient.multi().incr(useKey);

      if (opts?.expire) {
        multi.expire(useKey, opts?.expire.seconds);
      }

      const [newVal] = await multi.exec();

      return newVal as unknown as number;
    },

    async decrement(key) {
      const useKey = this.generateKey(key);

      return redisClient.decr(useKey);
    },

    async setFeedHtmlContent({ key, body }) {
      try {
        await redisClient.set(key, body, {
          EX: 60 * 15, // 15 minutes
        });
      } catch (err) {
        logger.error(`Failed to set html content in cache storage`, {
          err: (err as Error).stack,
        });
      }
    },

    async getFeedHtmlContent({ key }) {
      try {
        const res = await redisClient.get(key);

        if (!res) {
          return '';
        }

        return res;
      } catch (err) {
        logger.error(
          `Error getting feed html content from cache: ${(err as Error).message}`,
          {
            stack: (err as Error).stack,
          },
        );

        return '';
      }
    },
  };
}

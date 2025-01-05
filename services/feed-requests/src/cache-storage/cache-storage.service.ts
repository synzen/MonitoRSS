import { Inject, Injectable } from '@nestjs/common';
import { RedisClient } from './constants/redis-client.constant';
import { RedisClientType } from 'redis';
import logger from '../utils/logger';

@Injectable()
export class CacheStorageService {
  constructor(
    @Inject(RedisClient) private readonly redisClient: RedisClientType,
  ) {}

  async closeClient() {
    await this.redisClient.disconnect();
  }

  generateKey(key: string) {
    return `feed-requests:${key}`;
  }

  async set({
    key,
    body,
    expSeconds,
    getOldValue,
  }: {
    body: string;
    key: string;
    expSeconds?: number;
    getOldValue?: boolean;
  }) {
    try {
      return await this.redisClient.set(this.generateKey(key), body, {
        EX: expSeconds,
        GET: getOldValue ? true : undefined,
      });
    } catch (err) {
      logger.error(`Failed to set content in cache storage`, {
        err: (err as Error).stack,
      });
    }
  }

  async del(key: string) {
    try {
      await this.redisClient.del(this.generateKey(key));
    } catch (err) {
      logger.error(`Failed to delete content from cache storage`, {
        err: (err as Error).stack,
      });
    }
  }

  async increment(
    key: string,
    opts?: {
      expire?: {
        seconds: number;
        mode: 'NX';
      };
    },
  ): Promise<number> {
    const useKey = this.generateKey(key);

    const multi = this.redisClient.multi().incr(useKey);

    if (opts?.expire) {
      multi.expire(useKey, opts?.expire.seconds);
    }

    const [newVal] = await multi.exec();

    return newVal as number;
  }

  async decrement(key: string): Promise<number> {
    const useKey = this.generateKey(key);

    return this.redisClient.decr(useKey);
  }

  async setFeedHtmlContent({ key, body }: { body: string; key: string }) {
    try {
      await this.redisClient.set(key, body, {
        EX: 60 * 15, // 15 minutes
      });
    } catch (err) {
      logger.error(`Failed to set html content in cache storage`, {
        err: (err as Error).stack,
      });
    }
  }

  async getFeedHtmlContent({ key }: { key: string }): Promise<string> {
    try {
      const res = await this.redisClient.get(key);

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
  }
}

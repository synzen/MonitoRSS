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

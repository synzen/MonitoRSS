import { Inject, Injectable, Scope } from "@nestjs/common";
import { RedisClient } from "./constants/redis-client.constant";
import { RedisClientType } from "redis";
import logger from "../shared/utils/logger";

const generateKey = (key: string) => {
  return `user-feeds:${key}`;
};

@Injectable({
  scope: Scope.DEFAULT,
})
export class CacheStorageService {
  constructor(
    @Inject(RedisClient) private readonly redisClient: RedisClientType
  ) {}

  async closeClient() {
    this.redisClient.removeAllListeners();

    await this.redisClient.disconnect();
  }

  async set({
    key,
    body,
    expSeconds,
    getOldValue,
    useOldTTL,
  }: {
    body: string;
    key: string;
    expSeconds?: number;
    getOldValue?: boolean;
    useOldTTL?: boolean;
  }) {
    let ex = expSeconds || 60 * 5; // default expire in 5m

    if (useOldTTL) {
      try {
        const ttl = await this.redisClient.ttl(generateKey(key));

        if (ttl !== -1) {
          ex = ttl;
        }
      } catch (err) {
        logger.error(`Failed to get TTL of key ${key} from cache storage`, {
          err: (err as Error).stack,
        });
      }
    }

    try {
      return await this.redisClient.set(generateKey(key), body, {
        EX: ex,
        GET: getOldValue ? true : undefined,
      });
    } catch (err) {
      logger.error(`Failed to set content in cache storage`, {
        err: (err as Error).stack,
      });
    }
  }

  async get({ key }: { key: string }) {
    try {
      return await this.redisClient.get(generateKey(key));
    } catch (err) {
      logger.error(`Failed to get content with key ${key} from cache storage`, {
        err: (err as Error).stack,
      });

      return null;
    }
  }

  async del(key: string) {
    try {
      await this.redisClient.del(generateKey(key));
    } catch (err) {
      logger.error(`Failed to delete content from cache storage`, {
        err: (err as Error).stack,
      });
    }
  }

  async exists(key: string) {
    try {
      return await this.redisClient.exists(generateKey(key));
    } catch (err) {
      logger.error(`Failed to check existence of key ${key} in cache storage`, {
        err: (err as Error).stack,
      });

      return false;
    }
  }

  async setExpire(key: string, seconds: number) {
    try {
      await this.redisClient.expire(generateKey(key), seconds);
    } catch (err) {
      logger.error(`Failed to set expire for key ${key} in cache storage`, {
        err: (err as Error).stack,
      });
    }
  }
}

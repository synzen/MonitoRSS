import { Inject, Injectable } from "@nestjs/common";
import { RedisClient } from "./constants/redis-client.constant";
import { RedisClientType } from "redis";
import logger from "../shared/utils/logger";

const generateKey = (key: string) => {
  return `user-feeds:${key}`;
};

@Injectable()
export class CacheStorageService {
  constructor(
    @Inject(RedisClient) private readonly redisClient: RedisClientType
  ) {}

  async closeClient() {
    await this.redisClient.disconnect();
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
      return await this.redisClient.set(generateKey(key), body, {
        EX: expSeconds || 60 * 5, // default expire in 5m
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
      await this.redisClient.del(generateKey(key));
    } catch (err) {
      logger.error(`Failed to delete content from cache storage`, {
        err: (err as Error).stack,
      });
    }
  }
}

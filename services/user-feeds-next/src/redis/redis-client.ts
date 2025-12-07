import { createClient, createCluster } from "redis";
import type { RedisClientType, RedisClusterType } from "redis";
import { logger } from "../utils";

export type RedisClient = RedisClientType | RedisClusterType;

export interface RedisConfig {
  uri: string;
  disableCluster?: boolean;
}

let client: RedisClient | null = null;

/**
 * Initialize the Redis client.
 * Supports both cluster and single client modes via the disableCluster option.
 * Matches the behavior in user-feeds/src/cache-storage/cache-storage.module.ts
 */
export async function initializeRedisClient(
  config: RedisConfig
): Promise<RedisClient> {
  if (client) {
    return client;
  }

  if (config.disableCluster) {
    client = createClient({ url: config.uri });
  } else {
    client = createCluster({
      rootNodes: [{ url: config.uri }],
    });
  }

  client.on("error", (err) => {
    logger.error(`Redis client error: ${(err as Error).message}`, {
      stack: (err as Error).stack,
    });
  });

  await client.connect();
  logger.info("Successfully connected to Redis");

  return client;
}

/**
 * Get the initialized Redis client.
 * Throws if client has not been initialized.
 */
export function getRedisClient(): RedisClient {
  if (!client) {
    throw new Error(
      "Redis client not initialized. Call initializeRedisClient first."
    );
  }
  return client;
}

/**
 * Close the Redis client connection.
 * Should be called during graceful shutdown.
 */
export async function closeRedisClient(): Promise<void> {
  if (client) {
    try {
      client.removeAllListeners();
      await client.disconnect();
      client = null;
      logger.info("Successfully closed Redis client");
    } catch (err) {
      logger.error("Failed to close Redis client", {
        error: (err as Error).stack,
      });
    }
  }
}

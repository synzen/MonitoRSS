import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CacheStorageService } from "./cache-storage.service";
import { RedisClient } from "./constants/redis-client.constant";
import {
  RedisClientType,
  RedisClusterType,
  createClient,
  createCluster,
} from "redis";
import logger from "../shared/utils/logger";

@Module({
  imports: [],
  controllers: [],
  providers: [
    {
      provide: RedisClient,
      useFactory: async (configService: ConfigService) => {
        const uri = configService.getOrThrow("USER_FEEDS_REDIS_URI");
        const disableCluster = configService.get(
          "USER_FEEDS_REDIS_DISABLE_CLUSTER"
        );

        let client: RedisClientType | RedisClusterType;

        if (disableCluster) {
          client = createClient({
            url: uri,
          });
        } else {
          client = createCluster({
            rootNodes: [
              {
                url: uri,
              },
            ],
          });
        }

        client.on("error", (err) => {
          logger.error(`Redis client error: ${(err as Error).message}`, {
            stack: err.stack,
          });
        });

        await client.connect();

        logger.info(`Successfully connected to Redis`);

        return client;
      },
      inject: [ConfigService],
    },
    CacheStorageService,
  ],
  exports: [CacheStorageService],
})
export class CacheStorageModule {}

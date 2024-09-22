import { Injectable } from '@nestjs/common';
import { PartitionedRequestInsert } from './types/partitioned-request.type';
import { createHash } from 'crypto';
import { MikroORM } from '@mikro-orm/core';
import logger from '../utils/logger';

const sha1 = createHash('sha1');

@Injectable()
export default class PartitionedRequestsStoreService {
  private pendingInserts: PartitionedRequestInsert[] = [];

  constructor(private readonly orm: MikroORM) {}

  async markForPersistence(
    responseInsert: PartitionedRequestInsert,
  ): Promise<void> {
    this.pendingInserts.push(responseInsert);
  }

  async flushPendingInserts(): Promise<void> {
    if (this.pendingInserts.length === 0) {
      return;
    }

    const em = this.orm.em.fork().getConnection();
    const transaction = await em.begin();

    try {
      await Promise.all(
        this.pendingInserts.map((responseInsert) => {
          const urlHash = sha1.copy().update(responseInsert.url).digest('hex');

          return em.execute(
            `INSERT INTO request_partitioned (
              status,
              source,
              fetch_options,
              url,
              url_hash,
              lookup_key,
              created_at,
              next_retry_date,
              error_message,
              response_status_code,
              response_text_hash,
              response_s3object_key,
              response_redis_cache_key,
              response_headers
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )`,
            [
              responseInsert.status,
              responseInsert.source,
              this.stringifyJson(responseInsert.fetchOptions),
              responseInsert.url,
              urlHash,
              responseInsert.lookupKey,
              responseInsert.createdAt,
              responseInsert.nextRetryDate,
              responseInsert.errorMessage,
              responseInsert.response?.statusCode,
              responseInsert.response?.textHash,
              responseInsert.response?.s3ObjectKey,
              responseInsert.response?.redisCacheKey,
              this.stringifyJson(responseInsert.response?.headers),
            ],
            transaction,
          );
        }),
      );
      await em.commit(transaction);
    } catch (err) {
      await em.rollback(transaction);

      logger.error('Failed to insert partitioned requests', {
        error: (err as Error).stack,
      });
    }

    this.pendingInserts.length = 0;
  }

  private stringifyJson(json?: object | null): string | null {
    if (!json) {
      return null;
    }

    return JSON.stringify(json);
  }
}

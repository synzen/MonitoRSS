import { Injectable } from '@nestjs/common';
import { PartitionedRequestInsert } from './types/partitioned-request.type';
import { createHash, randomUUID } from 'crypto';
import { MikroORM } from '@mikro-orm/core';
import { RequestSource } from '../feed-fetcher/constants/request-source.constants';
import { Request } from '../feed-fetcher/entities';
import { RequestStatus } from '../feed-fetcher/constants';

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
              id,
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
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )`,
            [
              randomUUID(),
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

      throw err;
    } finally {
      this.pendingInserts.length = 0;
    }
  }

  async getLatestNextRetryDate(lookupKey: string): Promise<Date | null> {
    const em = this.orm.em.getConnection();

    const [result] = await em.execute(
      `SELECT next_retry_date FROM request_partitioned
       WHERE lookup_key = ?
       AND next_retry_date IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [lookupKey],
    );

    if (!result) {
      return null;
    }

    return new Date(result.next_retry_date) || null;
  }

  async getLatestOkRequest(
    lookupKey: string,
  ): Promise<null | { createdAt: Date }> {
    const em = this.orm.em.getConnection();

    const [result] = await em.execute(
      `SELECT created_at FROM request_partitioned
       WHERE lookup_key = ?
       AND status = 'OK'
       ORDER BY created_at DESC
       LIMIT 1`,
      [lookupKey],
    );

    if (!result) {
      return null;
    }

    return { createdAt: new Date(result.created_at) };
  }

  async countFailedRequests(lookupKey: string, since?: Date) {
    const em = this.orm.em.getConnection();

    const params = [lookupKey];

    if (since) {
      params.push(since.toISOString());
    }

    const [result] = await em.execute(
      `SELECT COUNT(*) FROM request_partitioned
       WHERE lookup_key = ?
       AND status != 'OK'
        ${since ? 'AND created_at >= ?' : ''}
       `,
      params,
    );

    return parseInt(result.count, 10);
  }

  async getLatestStatusAfterTime(lookupKey: string, time: Date) {
    const em = this.orm.em.getConnection();

    const [result] = await em.execute(
      `SELECT status FROM request_partitioned
       WHERE lookup_key = ?
       AND created_at > ?
       AND source = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [lookupKey, time.toISOString(), RequestSource.Schedule],
    );

    if (!result) {
      return null;
    }

    return { status: result.status as RequestStatus };
  }

  async getRequests({
    limit,
    skip,
    url,
  }: {
    skip: number;
    limit: number;
    url: string;
  }): Promise<Request[]> {
    const em = this.orm.em.getConnection();

    const results = await em.execute(
      `SELECT id, created_at, next_retry_date, status, response_status_code FROM request_partitioned
       WHERE lookup_key = ?
       ORDER BY created_at DESC
       LIMIT ?
       OFFSET ?`,
      [url, limit, skip],
    );

    return results.map((result) => ({
      id: result.id,
      createdAt: new Date(result.created_at),
      nextRetryDate: result.next_retry_date,
      status: result.status,
      response: result.response_status_code
        ? {
            statusCode: result.response_status_code,
          }
        : null,
    }));
  }

  async getLatestRequest(lookupKey: string): Promise<Request | null> {
    const em = this.orm.em.getConnection();

    const [result] = await em.execute(
      `SELECT * FROM request_partitioned
       WHERE lookup_key = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [lookupKey],
    );

    if (!result) {
      return null;
    }

    return this.mapPartitionedRequestToModel(result);
  }

  private mapPartitionedRequestToModel(result: any) {
    const request: Request = {
      id: result.id,
      status: result.status,
      source: result.source,
      createdAt: new Date(result.created_at),
      lookupKey: result.lookup_key,
      nextRetryDate: result.next_retry_date,
      url: result.url,
      fetchOptions: result.fetch_options,
      errorMessage: result.error_message,
      response: result.response_status_code
        ? {
            id: result.id,
            statusCode: result.response_status_code,
            textHash: result.response_text_hash,
            hasCompressedText: true,
            isCloudflare: false,
            s3ObjectKey: result.response_s3object_key,
            redisCacheKey: result.response_redis_cache_key,
            headers: result.response_headers,
            createdAt: new Date(result.created_at),
          }
        : null,
    };

    return request;
  }

  private stringifyJson(json?: object | null): string | null {
    if (!json) {
      return null;
    }

    return JSON.stringify(json);
  }
}

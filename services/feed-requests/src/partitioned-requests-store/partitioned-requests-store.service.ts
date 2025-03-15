import { Injectable } from '@nestjs/common';
import { PartitionedRequestInsert } from './types/partitioned-request.type';
import { createHash } from 'crypto';
import { MikroORM } from '@mikro-orm/core';
import { RequestSource } from '../feed-fetcher/constants/request-source.constants';
import { Request } from '../feed-fetcher/entities';
import { RequestStatus } from '../feed-fetcher/constants';
import { getUrlHost } from '../utils/get-url-host';
import logger from '../utils/logger';

const sha1 = createHash('sha1');

@Injectable()
export default class PartitionedRequestsStoreService {
  constructor(private readonly orm: MikroORM) {}

  async wasRequestedInPastSeconds(
    lookupKey: string,
    timeframeSeconds: number,
  ): Promise<boolean> {
    const em = this.orm.em.getConnection();

    const [result] = await em.execute(
      `SELECT 1 FROM request_partitioned
       WHERE lookup_key = ?
       AND created_at >= NOW() - INTERVAL ? SECOND
       LIMIT 1`,
      [lookupKey, timeframeSeconds.toString()],
    );

    return !!result;
  }

  async flushInserts(inserts: PartitionedRequestInsert[]): Promise<void> {
    if (inserts.length === 0) {
      return;
    }

    const em = this.orm.em.fork().getConnection();
    const transaction = await em.begin();

    try {
      if (inserts.some((i) => i.response?.s3ObjectKey)) {
        logger.info('DEBUG: Flushing pending inserts', {
          pendingInserts: inserts.map((i) => ({
            id: i.id,
            lookupKey: i.lookupKey,
            url: i.url,
          })),
        });
      }

      await Promise.all(
        inserts.map(async (responseInsert) => {
          const urlHash = sha1.copy().update(responseInsert.url).digest('hex');
          let hostHash: string | null = null;

          try {
            const host = getUrlHost(responseInsert.url);
            hostHash = sha1.copy().update(host).digest('hex');
          } catch (err) {
            logger.error('Failed to get host from url', {
              url: responseInsert.url,
              err: (err as Error).stack,
            });
          }

          if (responseInsert.response?.body) {
            const contentHash = sha1
              .copy()
              .update(responseInsert.response.body.contents)
              .digest('hex');

            // does this content already exist in the db?
            const results = await em.execute(
              `SELECT 1 FROM response_bodies WHERE hash_key = ? AND content_hash = ?`,
              [responseInsert.response.body.hashKey, contentHash],
            );

            if (results.length === 0) {
              await em.execute(
                `INSERT INTO response_bodies (content, content_hash, hash_key) VALUES (?, ?, ?)
                ON CONFLICT (hash_key) DO UPDATE SET content = ?, content_hash = ?
              `,
                [
                  responseInsert.response.body.contents,
                  contentHash,
                  responseInsert.response.body.hashKey,
                  responseInsert.response.body.contents,
                  contentHash,
                ],
                transaction,
              );
            }
          }

          return em.execute(
            `INSERT INTO request_partitioned (
              id,
              status,
              source,
              fetch_options,
              url,
              url_hash,
              host_hash,
              lookup_key,
              created_at,
              next_retry_date,
              error_message,
              response_status_code,
              response_text_hash,
              response_body_hash_key,
              response_s3object_key,
              response_redis_cache_key,
              response_headers,
              request_initiated_at
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )`,
            [
              responseInsert.id,
              responseInsert.status,
              responseInsert.source,
              this.stringifyJson(responseInsert.fetchOptions),
              responseInsert.url,
              urlHash,
              hostHash,
              responseInsert.lookupKey,
              responseInsert.createdAt,
              responseInsert.nextRetryDate,
              responseInsert.errorMessage,
              responseInsert.response?.statusCode,
              null,
              responseInsert.response?.body?.hashKey,
              responseInsert.response?.s3ObjectKey,
              responseInsert.response?.redisCacheKey,
              this.stringifyJson(responseInsert.response?.headers),
              responseInsert.requestInitiatedAt,
            ],
            transaction,
          );
        }),
      );
      await em.commit(transaction);
    } catch (err) {
      await em.rollback(transaction);

      throw err;
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

  async getLatestRequestWithOkStatus(
    lookupKey: string,
    opts: {
      fields?: Array<'response_headers'>;
    },
  ): Promise<null | {
    createdAt: Date;
    responseHeaders?: Record<string, string>;
    requestInitiatedAt: Date | null;
  }> {
    const em = this.orm.em.getConnection();

    const [result] = await em.execute(
      `SELECT request_initiated_at, created_at ${
        opts?.fields?.includes('response_headers') ? ', response_headers' : ''
      } FROM request_partitioned
       WHERE lookup_key = ?
       AND status = 'OK'
       ORDER BY created_at DESC
       LIMIT 1`,
      [lookupKey],
    );

    if (!result) {
      return null;
    }

    return {
      createdAt: new Date(result.created_at),
      responseHeaders: result.response_headers,
      requestInitiatedAt: result.request_initiated_at,
    };
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
       AND status IN (
        'INTERNAL_ERROR',
        'FETCH_ERROR',
        'PARSE_ERROR',
        'BAD_STATUS_CODE',
        'FETCH_TIMEOUT',
        'REFUSED_LARGE_FEED',
        'INVALID_SSL_CERTIFICATE'
       )
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
    lookupKey,
    afterDate,
    beforeDate,
  }: {
    skip: number;
    limit: number;
    url: string;
    lookupKey?: string;
    afterDate?: string;
    beforeDate?: string;
  }) {
    const em = this.orm.em.getConnection();

    const results: Array<{
      id: number;
      url: string;
      created_at: Date;
      next_retry_date: Date;
      status: RequestStatus;
      response_status_code: number | null;
      fetch_options: Record<string, string> | null;
      response_headers: Record<string, string> | null;
      request_initiated_at: Date | null;
    }> = await em.execute(
      `SELECT id, url, created_at, next_retry_date, status, response_status_code,` +
        ` fetch_options, response_headers, request_initiated_at FROM request_partitioned
       WHERE lookup_key = ?
       ${afterDate ? 'AND created_at >= ?' : ''}
       ${beforeDate ? 'AND created_at <= ?' : ''}
       ORDER BY created_at DESC
       LIMIT ?
       OFFSET ?`,
      [
        lookupKey || url,
        ...(afterDate ? [afterDate] : []),
        ...(beforeDate ? [beforeDate] : []),
        limit,
        skip,
      ],
    );

    return results.map((result) => ({
      id: result.id,
      createdAt: new Date(result.request_initiated_at || result.created_at),
      finishedAt: new Date(result.created_at),
      nextRetryDate: result.next_retry_date,
      url: result.url,
      status: result.status,
      fetchOptions: result.fetch_options,
      response: result.response_status_code
        ? {
            statusCode: result.response_status_code,
            headers: result.response_headers,
          }
        : null,
    }));
  }

  async getLatestRequestWithResponseBody(
    lookupKey: string,
  ): Promise<Request | null> {
    const em = this.orm.em.getConnection();

    const [result] = await em.execute(
      `SELECT req.*, res.content AS response_body_content,
        res.content_hash AS response_content_hash
       FROM request_partitioned req
       LEFT JOIN response_bodies res
       ON req.response_body_hash_key = res.hash_key
       WHERE req.lookup_key = ?
       AND req.response_status_code != 304
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
      createdAt: new Date(result.request_initiated_at),
      lookupKey: result.lookup_key,
      nextRetryDate: result.next_retry_date,
      url: result.url,
      fetchOptions: result.fetch_options,
      errorMessage: result.error_message,
      response: result.response_status_code
        ? {
            id: result.id,
            statusCode: result.response_status_code,
            textHash: result.response_content_hash,
            hasCompressedText: true,
            isCloudflare: false,
            s3ObjectKey: result.response_s3object_key,
            redisCacheKey: result.response_redis_cache_key,
            headers: result.response_headers,
            createdAt: new Date(result.created_at),
            content: result.response_body_content,
            responseHashKey: result.response_body_hash_key,
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

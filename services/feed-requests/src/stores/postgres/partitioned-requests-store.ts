import { createHash } from 'crypto';
import type { Pool } from 'pg';
import {
  RequestSource,
  RequestStatus,
  type PartitionedRequestInsert,
  type Request,
} from '../../feed-fetcher/types';
import { getUrlHost } from '../../utils/get-url-host';
import logger from '../../utils/logger';
import { createExecutor, toPgPlaceholders, withTransaction } from './index';

const sha1 = createHash('sha1');

export interface PartitionedRequestsStore {
  wasRequestedInPastSeconds(
    lookupKey: string,
    timeframeSeconds: number,
  ): Promise<boolean>;
  flushInserts(inserts: PartitionedRequestInsert[]): Promise<void>;
  getLatestNextRetryDate(lookupKey: string, since?: Date): Promise<Date | null>;
  getLatestRequestWithOkStatus(
    lookupKey: string,
    opts: {
      fields?: Array<'response_headers'>;
    },
  ): Promise<null | {
    createdAt: Date;
    responseHeaders?: Record<string, string>;
    requestInitiatedAt: Date | null;
  }>;
  countFailedRequests(lookupKey: string, since?: Date): Promise<number>;
  getLatestStatusAfterTime(
    lookupKey: string,
    time: Date,
  ): Promise<{ status: RequestStatus } | null>;
  getRequests(params: {
    skip: number;
    limit: number;
    url: string;
    lookupKey?: string;
    afterDate?: string;
    beforeDate?: string;
  }): Promise<
    Array<{
      id: string;
      createdAt: Date;
      finishedAt: Date;
      nextRetryDate: Date | null;
      url: string;
      status: RequestStatus;
      fetchOptions: Record<string, string> | null;
      response: {
        statusCode: number;
        headers: Record<string, string> | null;
      } | null;
    }>
  >;
  getLatestRequestWithResponseBody(lookupKey: string): Promise<Request | null>;
  getLatestRequestNon304(lookupKey: string): Promise<Request | null>;
  getLatestRequestAnyStatus(lookupKey: string): Promise<Request | null>;
}

export function createPartitionedRequestsStore(
  pool: Pool,
): PartitionedRequestsStore {
  const exec = createExecutor(pool);

  const query = async (sql: string, params?: unknown[]) =>
    exec(toPgPlaceholders(sql), params);

  return {
    async wasRequestedInPastSeconds(lookupKey, timeframeSeconds) {
      const rows = await query(
        // make_interval is the parameter-safe form of "NOW() - INTERVAL n SECOND"
        `SELECT 1 FROM request_partitioned
       WHERE lookup_key = ?
       AND created_at >= NOW() - make_interval(secs => ?::int)
       LIMIT 1`,
        [lookupKey, timeframeSeconds.toString()],
      );

      return rows.length > 0;
    },

    async flushInserts(inserts) {
      if (inserts.length === 0) {
        return;
      }

      const stringifyJson = (json?: object | null) =>
        json ? JSON.stringify(json) : null;

      await withTransaction(pool, async (txExec) => {
        const query = async (sql: string, params?: unknown[]) =>
          txExec(toPgPlaceholders(sql), params);

        if (inserts.some((i) => i.response?.s3ObjectKey)) {
          logger.info('DEBUG: Flushing pending inserts', {
            pendingInserts: inserts.map((i) => ({
              id: i.id,
              lookupKey: i.lookupKey,
              url: i.url,
            })),
          });
        }

        for (const responseInsert of inserts) {
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
            const results = await query(
              `SELECT 1 FROM response_bodies WHERE hash_key = ? AND content_hash = ?`,
              [responseInsert.response.body.hashKey, contentHash],
            );

            if (results.length === 0) {
              await query(
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
              );
            }
          }

          await query(
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
              responseInsert.source ?? null,
              stringifyJson(responseInsert.fetchOptions),
              responseInsert.url,
              urlHash,
              hostHash,
              responseInsert.lookupKey ?? null,
              responseInsert.createdAt,
              responseInsert.nextRetryDate ?? null,
              responseInsert.errorMessage ?? null,
              responseInsert.response?.statusCode ?? null,
              null,
              responseInsert.response?.body?.hashKey ?? null,
              responseInsert.response?.s3ObjectKey ?? null,
              responseInsert.response?.redisCacheKey ?? null,
              stringifyJson(responseInsert.response?.headers),
              responseInsert.requestInitiatedAt,
            ],
          );
        }
      });
    },

    async getLatestNextRetryDate(lookupKey, since) {
      const rows = await query(
        `SELECT next_retry_date FROM request_partitioned
       WHERE lookup_key = ?
       AND next_retry_date IS NOT NULL
       ${since ? 'AND created_at >= ?' : ''}
       ORDER BY created_at DESC
       LIMIT 1`,
        since ? [lookupKey, since.toISOString()] : [lookupKey],
      );

      const result = rows[0];

      if (!result) {
        return null;
      }

      return new Date(result.next_retry_date) || null;
    },

    async getLatestRequestWithOkStatus(lookupKey, opts) {
      const rows = await query(
        `SELECT request_initiated_at, created_at ${
          opts?.fields?.includes('response_headers') ? ', response_headers' : ''
        } FROM request_partitioned
       WHERE lookup_key = ?
       AND status = 'OK'
       ORDER BY created_at DESC
       LIMIT 1`,
        [lookupKey],
      );

      const result = rows[0];

      if (!result) {
        return null;
      }

      return {
        createdAt: new Date(result.created_at),
        responseHeaders: result.response_headers,
        requestInitiatedAt: result.request_initiated_at
          ? new Date(result.request_initiated_at)
          : null,
      };
    },

    async countFailedRequests(lookupKey, since) {
      const params: unknown[] = [lookupKey];

      if (since) {
        params.push(since.toISOString());
      }

      const rows = await query(
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

      return parseInt(rows[0].count, 10);
    },

    async getLatestStatusAfterTime(lookupKey, time) {
      const rows = await query(
        `SELECT status FROM request_partitioned
       WHERE lookup_key = ?
       AND created_at > ?
       AND source = ?
       ORDER BY created_at DESC
       LIMIT 1`,
        [lookupKey, time.toISOString(), RequestSource.Schedule],
      );

      const result = rows[0];

      if (!result) {
        return null;
      }

      return { status: result.status as RequestStatus };
    },

    async getRequests({ limit, skip, url, lookupKey, afterDate, beforeDate }) {
      const rows = (await query(
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
      )) as unknown as RequestRow[];

      return rows.map((result) => ({
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
    },

    async getLatestRequestWithResponseBody(lookupKey) {
      const rows = (await query(
        `SELECT req.*, res.content AS response_body_content,
        res.content_hash AS response_content_hash
       FROM request_partitioned req
       LEFT JOIN response_bodies res
       ON req.response_body_hash_key = res.hash_key
       WHERE req.lookup_key = ?
       AND req.response_status_code != 304
       AND response_body_hash_key IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1`,
        [lookupKey],
      )) as unknown as JoinedRequestRow[];

      const result = rows[0];

      if (!result) {
        return null;
      }

      if (!result.response_body_content) {
        /**
         * Handle cases where response bodies were temporarily stored in S3 and Redis instead
         */
        return null;
      }

      return mapPartitionedRequestToModel(result);
    },

    async getLatestRequestNon304(lookupKey) {
      const rows = (await query(
        `SELECT req.*, res.content AS response_body_content,
        res.content_hash AS response_content_hash
       FROM request_partitioned req
       LEFT JOIN response_bodies res
       ON req.response_body_hash_key = res.hash_key
       WHERE req.lookup_key = ?
       AND (req.response_status_code != 304 OR req.response_status_code IS NULL)
       ORDER BY created_at DESC
       LIMIT 1`,
        [lookupKey],
      )) as unknown as JoinedRequestRow[];

      const result = rows[0];

      if (!result) {
        return null;
      }

      return mapPartitionedRequestToModel(result);
    },

    async getLatestRequestAnyStatus(lookupKey) {
      const rows = (await query(
        `SELECT req.*, res.content AS response_body_content,
        res.content_hash AS response_content_hash
       FROM request_partitioned req
       LEFT JOIN response_bodies res
       ON req.response_body_hash_key = res.hash_key
       WHERE req.lookup_key = ?
       ORDER BY created_at DESC
       LIMIT 1`,
        [lookupKey],
      )) as unknown as JoinedRequestRow[];

      const result = rows[0];

      if (!result) {
        return null;
      }

      return mapPartitionedRequestToModel(result);
    },
  };
}

interface RequestRow {
  // TEXT column; pg returns it as a string.
  id: string;
  url: string;
  created_at: Date;
  next_retry_date: Date | null;
  status: RequestStatus;
  response_status_code: number | null;
  fetch_options: Record<string, string> | null;
  response_headers: Record<string, string> | null;
  request_initiated_at: Date | null;
}

// The row shape of the getLatestRequest* queries, which join the response
// bodies table onto every request_partitioned column.
interface JoinedRequestRow extends RequestRow {
  source: string | null;
  error_message: string | null;
  lookup_key: string | null;
  response_s3object_key: string | null;
  response_redis_cache_key: string | null;
  response_body_hash_key: string | null;
  response_body_content: string | null;
  response_content_hash: string | null;
}

function mapPartitionedRequestToModel(result: JoinedRequestRow): Request {
  const request: Request = {
    id: result.id,
    status: result.status,
    source: result.source,
    // Rows predating the request_initiated_at column map to the epoch, as
    // the pre-migration store service did.
    createdAt: new Date(result.request_initiated_at ?? 0),
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

export default createPartitionedRequestsStore;

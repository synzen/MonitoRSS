import { AsyncLocalStorage } from "node:async_hooks";
import type { SQL } from "bun";
import type {
  DeliveryRecordStore,
  ArticleDeliveryState,
  PartitionedDeliveryRecordInsert,
  ArticleDeliveryStatus,
  DeliveryLog,
} from "../interfaces/delivery-record-store";
import {
  DeliveryLogStatus,
  ArticleDeliveryErrorCode,
  ArticleDeliveryStatus as DeliveryStatus,
} from "../interfaces/delivery-record-store";
import { logger } from "../../shared/utils";

const { Sent, Failed, Rejected, PendingDelivery, FilteredOut } = {
  Sent: "sent" as ArticleDeliveryStatus,
  Failed: "failed" as ArticleDeliveryStatus,
  Rejected: "rejected" as ArticleDeliveryStatus,
  PendingDelivery: "pending-delivery" as ArticleDeliveryStatus,
  FilteredOut: "filtered-out" as ArticleDeliveryStatus,
};

interface AsyncStore {
  toInsert: PartitionedDeliveryRecordInsert[];
}

const asyncLocalStorage = new AsyncLocalStorage<AsyncStore>();

/**
 * Convert an ArticleDeliveryState to a PartitionedDeliveryRecordInsert.
 */
function stateToInsert(
  feedId: string,
  state: ArticleDeliveryState
): PartitionedDeliveryRecordInsert {
  const { status } = state;
  const articleData = state.article?.flattened.title
    ? { title: state.article.flattened.title }
    : null;

  const base: PartitionedDeliveryRecordInsert = {
    id: state.id,
    feedId,
    mediumId: state.mediumId,
    createdAt: new Date(),
    status,
    contentType: null,
    parentId: null,
    internalMessage: null,
    errorCode: null,
    externalDetail: null,
    articleId: state.article?.flattened.id ?? null,
    articleIdHash: state.articleIdHash,
    articleData,
  };

  switch (status) {
    case Sent:
      return {
        ...base,
        contentType: (state as { contentType?: string }).contentType ?? null,
        parentId: (state as { parent?: string }).parent ?? null,
      } as PartitionedDeliveryRecordInsert;

    case Failed:
    case Rejected:
      return {
        ...base,
        errorCode: (state as { errorCode: string }).errorCode,
        internalMessage: (state as { internalMessage: string }).internalMessage,
        externalDetail:
          status === Rejected
            ? (state as { externalDetail: string }).externalDetail
            : null,
        contentType: (state as { contentType?: string }).contentType ?? null,
        parentId: (state as { parent?: string }).parent ?? null,
      } as PartitionedDeliveryRecordInsert;

    case PendingDelivery:
      return {
        ...base,
        contentType: (state as { contentType: string }).contentType,
        parentId: (state as { parent?: string }).parent ?? null,
      } as PartitionedDeliveryRecordInsert;

    case FilteredOut:
      return {
        ...base,
        externalDetail:
          (state as { externalDetail: string | null }).externalDetail ?? null,
        parentId: (state as { parent?: string }).parent ?? null,
      } as PartitionedDeliveryRecordInsert;

    default:
      return {
        ...base,
        parentId: (state as { parent?: string }).parent ?? null,
      };
  }
}

/**
 * Create a PostgreSQL-backed implementation of DeliveryRecordStore.
 * Uses Bun's native SQL module for partitioned table queries.
 */
export function createPostgresDeliveryRecordStore(sql: SQL): DeliveryRecordStore {
  return {
    async startContext<T>(cb: () => Promise<T>): Promise<T> {
      return asyncLocalStorage.run({ toInsert: [] }, cb);
    },

    async store(
      feedId: string,
      articleStates: ArticleDeliveryState[],
      flush = true
    ): Promise<{ inserted: number } | undefined> {
      const store = asyncLocalStorage.getStore();

      if (!store) {
        throw new Error("No context was started for DeliveryRecordStore");
      }

      const inserts = articleStates.map((state) => stateToInsert(feedId, state));

      for (const insert of inserts) {
        store.toInsert.push(insert);
      }

      if (flush) {
        const { affectedRows } = await this.flushPendingInserts();
        return { inserted: affectedRows };
      }

      return undefined;
    },

    async flushPendingInserts(): Promise<{ affectedRows: number }> {
      const store = asyncLocalStorage.getStore();

      if (!store) {
        throw new Error("No context was started for DeliveryRecordStore");
      }

      const { toInsert: inserts } = store;

      if (inserts.length === 0) {
        return { affectedRows: 0 };
      }

      try {
        // Use transaction with parallel inserts for efficiency
        // This matches user-feeds behavior and allows PostgreSQL to pipeline statements
        let affectedRows = 0;

        await sql.begin(async (tx) => {
          const results = await Promise.all(
            inserts.map((record) =>
              tx`
                INSERT INTO delivery_record_partitioned (
                  id,
                  feed_id,
                  medium_id,
                  created_at,
                  status,
                  content_type,
                  parent_id,
                  internal_message,
                  error_code,
                  external_detail,
                  article_id,
                  article_id_hash,
                  article_data
                ) VALUES (
                  ${record.id},
                  ${record.feedId},
                  ${record.mediumId},
                  ${record.createdAt},
                  ${record.status},
                  ${record.contentType},
                  ${record.parentId},
                  ${record.internalMessage},
                  ${record.errorCode},
                  ${record.externalDetail},
                  ${record.articleId},
                  ${record.articleIdHash},
                  ${record.articleData ? JSON.stringify(record.articleData) : null}::jsonb
                )
              `
            )
          );

          affectedRows = results.reduce((sum, r) => sum + r.count, 0);
        });

        return { affectedRows };
      } catch (err) {
        logger.error("Error inserting delivery records", {
          stack: (err as Error).stack,
        });
        throw err;
      } finally {
        store.toInsert = [];
      }
    },

    async updateDeliveryStatus(
      id: string,
      details: {
        status: ArticleDeliveryStatus;
        errorCode?: string;
        internalMessage?: string;
        externalDetail?: string;
        articleId?: string;
      }
    ): Promise<{
      feed_id: string;
      medium_id: string;
      status: ArticleDeliveryStatus;
      error_code?: string;
      internal_message?: string;
    }> {
      const { status, errorCode, internalMessage, externalDetail } = details;

      const [res] = await sql`
        UPDATE delivery_record_partitioned
        SET status = ${status},
            error_code = ${errorCode ?? null},
            internal_message = ${internalMessage ?? null},
            external_detail = ${externalDetail ?? null}
        WHERE id = ${id}
        RETURNING status, error_code, feed_id, medium_id, internal_message
      `;

      if (!res) {
        throw new Error(
          `Failed to update status of delivery record for ${id}: Record not found`
        );
      }

      return res as {
        feed_id: string;
        medium_id: string;
        status: ArticleDeliveryStatus;
        error_code?: string;
        internal_message?: string;
      };
    },

    async countDeliveriesInPastTimeframe(
      { mediumId, feedId }: { mediumId?: string; feedId?: string },
      secondsInPast: number
    ): Promise<number> {
      // Build dynamic query based on provided filters
      let result: Array<{ count: string }>;

      if (mediumId && feedId) {
        result = await sql`
          SELECT COUNT(*) as count FROM delivery_record_partitioned
          WHERE created_at >= NOW() - INTERVAL '1 second' * ${secondsInPast}
            AND status = ${Sent}
            AND medium_id = ${mediumId}
            AND feed_id = ${feedId}
        `;
      } else if (mediumId) {
        result = await sql`
          SELECT COUNT(*) as count FROM delivery_record_partitioned
          WHERE created_at >= NOW() - INTERVAL '1 second' * ${secondsInPast}
            AND status = ${Sent}
            AND medium_id = ${mediumId}
        `;
      } else if (feedId) {
        result = await sql`
          SELECT COUNT(*) as count FROM delivery_record_partitioned
          WHERE created_at >= NOW() - INTERVAL '1 second' * ${secondsInPast}
            AND status = ${Sent}
            AND feed_id = ${feedId}
        `;
      } else {
        result = await sql`
          SELECT COUNT(*) as count FROM delivery_record_partitioned
          WHERE created_at >= NOW() - INTERVAL '1 second' * ${secondsInPast}
            AND status = ${Sent}
        `;
      }

      return Number(result[0]?.count ?? 0);
    },

    async getDeliveryLogs(options: {
      feedId: string;
      skip: number;
      limit: number;
    }): Promise<DeliveryLog[]> {
      const { feedId, skip, limit } = options;

      // Get parent records (no parent_id)
      const parentRecords = await sql`
        SELECT id, status, error_code, medium_id,
          content_type, external_detail, article_id_hash, created_at, article_data
        FROM delivery_record_partitioned
        WHERE feed_id = ${feedId}
        AND parent_id IS NULL
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${skip}
      `;

      if (parentRecords.length === 0) {
        return [];
      }

      // Get child records for these parents
      const parentIds = parentRecords.map((r: { id: string }) => r.id);
      const childRecords = await sql`
        SELECT id, status, error_code, medium_id,
          content_type, external_detail, article_id_hash, created_at, parent_id, article_data
        FROM delivery_record_partitioned
        WHERE feed_id = ${feedId}
        AND parent_id = ANY(${parentIds})
      `;

      return parentRecords.map(
        (record: {
          id: string;
          status: string;
          error_code: string | null;
          medium_id: string;
          content_type: string | null;
          external_detail: string | null;
          article_id_hash: string | null;
          created_at: Date;
          article_data: Record<string, string> | null;
        }) => {
          const children = childRecords.filter(
            (child: { parent_id: string }) => child.parent_id === record.id
          );

          let status: DeliveryLogStatus;
          const details: { message?: string; data?: Record<string, unknown> } = {
            message: undefined,
            data: undefined,
          };

          if (record.status === DeliveryStatus.Sent) {
            if (
              children.some(
                (c: { status: string }) => c.status !== DeliveryStatus.Sent
              )
            ) {
              status = DeliveryLogStatus.PARTIALLY_DELIVERED;
            } else {
              status = DeliveryLogStatus.DELIVERED;
            }
          } else if (record.status === DeliveryStatus.Rejected) {
            status = DeliveryLogStatus.REJECTED;

            try {
              if (record.external_detail) {
                details.data = JSON.parse(record.external_detail)?.data;
              }
            } catch {}

            if (
              record.error_code === ArticleDeliveryErrorCode.NoChannelOrWebhook ||
              record.error_code === ArticleDeliveryErrorCode.ThirdPartyNotFound
            ) {
              details.message = "Connection destination does not exist";
            } else if (
              record.error_code === ArticleDeliveryErrorCode.ThirdPartyBadRequest
            ) {
              details.message = "Invalid message format";
              try {
                if (record.external_detail) {
                  details.data = JSON.parse(record.external_detail);
                }
              } catch {}
            } else if (
              record.error_code === ArticleDeliveryErrorCode.ThirdPartyForbidden
            ) {
              details.message =
                "Missing permissions to send to connection destination";
            } else if (
              record.error_code === ArticleDeliveryErrorCode.ThirdPartyInternal
            ) {
              details.message =
                "Connection target service was experiencing internal errors";
            } else if (
              record.error_code === ArticleDeliveryErrorCode.Internal
            ) {
              details.message = "Internal error";
            } else if (
              record.error_code === ArticleDeliveryErrorCode.ArticleProcessingError
            ) {
              details.message =
                "Failed to parse article content with current configuration";
              try {
                if (record.external_detail) {
                  details.data = JSON.parse(record.external_detail)?.message;
                }
              } catch {}
            }
          } else if (record.status === DeliveryStatus.Failed) {
            status = DeliveryLogStatus.FAILED;
          } else if (record.status === DeliveryStatus.PendingDelivery) {
            status = DeliveryLogStatus.PENDING_DELIVERY;
          } else if (record.status === DeliveryStatus.RateLimited) {
            status = DeliveryLogStatus.ARTICLE_RATE_LIMITED;
          } else if (record.status === DeliveryStatus.MediumRateLimitedByUser) {
            status = DeliveryLogStatus.MEDIUM_RATE_LIMITED;
          } else if (record.status === DeliveryStatus.FilteredOut) {
            status = DeliveryLogStatus.FILTERED_OUT;
            try {
              if (record.external_detail) {
                details.data = JSON.parse(record.external_detail);
              }
            } catch {}
          } else {
            throw new Error(
              `Unhandled article delivery status: ${record.status} for record: ${record.id}`
            );
          }

          return {
            id: record.id,
            mediumId: record.medium_id,
            createdAt: new Date(record.created_at).toISOString(),
            details,
            articleIdHash: record.article_id_hash,
            status,
            articleData: record.article_data,
          };
        }
      );
    },
  };
}

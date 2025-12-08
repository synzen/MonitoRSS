import { AsyncLocalStorage } from "node:async_hooks";
import {
  type DeliveryRecordStore,
  type ArticleDeliveryState,
  type PartitionedDeliveryRecordInsert,
  type DeliveryLog,
  ArticleDeliveryStatus,
  ArticleDeliveryContentType,
  ArticleDeliveryErrorCode,
  DeliveryLogStatus,
} from "../interfaces/delivery-record-store";

// ============================================================================
// AsyncLocalStorage Context
// ============================================================================

interface DeliveryRecordAsyncStore {
  toInsert: PartitionedDeliveryRecordInsert[];
}

const asyncLocalStorage = new AsyncLocalStorage<DeliveryRecordAsyncStore>();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert an ArticleDeliveryState to a PartitionedDeliveryRecordInsert.
 * Matches the logic in user-feeds DeliveryRecordService.store().
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
    case ArticleDeliveryStatus.Sent:
      return {
        ...base,
        contentType: state.contentType ?? null,
        parentId: state.parent ?? null,
      };

    case ArticleDeliveryStatus.Failed:
      return {
        ...base,
        errorCode: state.errorCode,
        internalMessage: state.internalMessage,
        parentId: state.parent ?? null,
      };

    case ArticleDeliveryStatus.Rejected:
      return {
        ...base,
        errorCode: state.errorCode,
        internalMessage: state.internalMessage,
        externalDetail: state.externalDetail,
        contentType: state.contentType ?? null,
        parentId: state.parent ?? null,
      };

    case ArticleDeliveryStatus.PendingDelivery:
      return {
        ...base,
        contentType: state.contentType,
        parentId: state.parent ?? null,
      };

    case ArticleDeliveryStatus.FilteredOut:
      return {
        ...base,
        externalDetail: state.externalDetail,
        parentId: state.parent ?? null,
      };

    case ArticleDeliveryStatus.RateLimited:
    case ArticleDeliveryStatus.MediumRateLimitedByUser:
      return {
        ...base,
        parentId: state.parent ?? null,
      };

    default:
      return base;
  }
}

// ============================================================================
// In-Memory Delivery Record Store
// ============================================================================

/**
 * Create an in-memory delivery record store.
 * Returns a fresh store instance for testing isolation.
 */
export function createInMemoryDeliveryRecordStore(): DeliveryRecordStore & {
  _records: Map<string, PartitionedDeliveryRecordInsert>;
  _clear: () => void;
} {
  const records = new Map<string, PartitionedDeliveryRecordInsert>();

  const store: DeliveryRecordStore & {
    _records: Map<string, PartitionedDeliveryRecordInsert>;
    _clear: () => void;
  } = {
    _records: records,
    _clear: () => records.clear(),

    async startContext<T>(cb: () => Promise<T>): Promise<T> {
      return asyncLocalStorage.run({ toInsert: [] }, cb);
    },

    async store(
      feedId: string,
      articleStates: ArticleDeliveryState[],
      flush = true
    ): Promise<{ inserted: number } | undefined> {
      const context = asyncLocalStorage.getStore();

      if (!context) {
        throw new Error("No context was started for DeliveryRecordStore");
      }

      const inserts = articleStates.map((state) =>
        stateToInsert(feedId, state)
      );

      for (const insert of inserts) {
        context.toInsert.push(insert);
      }

      if (flush) {
        const { affectedRows } = await store.flushPendingInserts();
        return { inserted: affectedRows };
      }

      return undefined;
    },

    async flushPendingInserts(): Promise<{ affectedRows: number }> {
      const context = asyncLocalStorage.getStore();

      if (!context) {
        throw new Error("No context was started for DeliveryRecordStore");
      }

      const { toInsert: inserts } = context;

      if (inserts.length === 0) {
        return { affectedRows: 0 };
      }

      try {
        // Persist all pending inserts
        for (const record of inserts) {
          records.set(record.id, record);
        }

        return { affectedRows: inserts.length };
      } finally {
        // Clear pending inserts
        context.toInsert = [];
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
      const record = records.get(id);

      if (!record) {
        throw new Error(
          `Failed to update status of delivery record for ${id}: Record not found`
        );
      }

      // Update the record
      record.status = details.status;
      record.errorCode = details.errorCode ?? record.errorCode;
      record.internalMessage =
        details.internalMessage ?? record.internalMessage;
      record.externalDetail = details.externalDetail ?? record.externalDetail;

      if (details.articleId) {
        record.articleId = details.articleId;
      }

      return {
        feed_id: record.feedId,
        medium_id: record.mediumId,
        status: record.status,
        error_code: record.errorCode ?? undefined,
        internal_message: record.internalMessage ?? undefined,
      };
    },

    async countDeliveriesInPastTimeframe(
      filter: { mediumId?: string; feedId?: string },
      secondsInPast: number
    ): Promise<number> {
      const cutoffTime = new Date(Date.now() - secondsInPast * 1000);
      let count = 0;

      for (const record of records.values()) {
        // Only count "sent" status
        if (record.status !== ArticleDeliveryStatus.Sent) {
          continue;
        }

        // Check time window
        if (record.createdAt < cutoffTime) {
          continue;
        }

        // Check filters
        if (filter.mediumId && record.mediumId !== filter.mediumId) {
          continue;
        }

        if (filter.feedId && record.feedId !== filter.feedId) {
          continue;
        }

        count++;
      }

      return count;
    },

    async getDeliveryLogs(options: {
      feedId: string;
      skip: number;
      limit: number;
    }): Promise<DeliveryLog[]> {
      const { feedId, skip, limit } = options;

      // Get all parent records (no parent_id) for this feed
      const parentRecords = Array.from(records.values())
        .filter((r) => r.feedId === feedId && r.parentId === null)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(skip, skip + limit);

      // Get child records for these parents
      const parentIds = new Set(parentRecords.map((r) => r.id));
      const childRecords = Array.from(records.values()).filter(
        (r) => r.feedId === feedId && r.parentId && parentIds.has(r.parentId)
      );

      return parentRecords.map((record) => {
        const children = childRecords.filter(
          (child) => child.parentId === record.id
        );

        let status: DeliveryLogStatus;
        const details: { message?: string; data?: Record<string, unknown> } = {
          message: undefined,
          data: undefined,
        };

        if (record.status === ArticleDeliveryStatus.Sent) {
          if (children.some((c) => c.status !== ArticleDeliveryStatus.Sent)) {
            status = DeliveryLogStatus.PARTIALLY_DELIVERED;
          } else {
            status = DeliveryLogStatus.DELIVERED;
          }
        } else if (record.status === ArticleDeliveryStatus.Rejected) {
          status = DeliveryLogStatus.REJECTED;

          try {
            if (record.externalDetail) {
              details.data = JSON.parse(record.externalDetail)?.data;
            }
          } catch {}

          if (
            record.errorCode === ArticleDeliveryErrorCode.NoChannelOrWebhook ||
            record.errorCode === ArticleDeliveryErrorCode.ThirdPartyNotFound
          ) {
            details.message = "Connection destination does not exist";
          } else if (
            record.errorCode === ArticleDeliveryErrorCode.ThirdPartyBadRequest
          ) {
            details.message = "Invalid message format";
            try {
              if (record.externalDetail) {
                details.data = JSON.parse(record.externalDetail);
              }
            } catch {}
          } else if (
            record.errorCode === ArticleDeliveryErrorCode.ThirdPartyForbidden
          ) {
            details.message =
              "Missing permissions to send to connection destination";
          } else if (
            record.errorCode === ArticleDeliveryErrorCode.ThirdPartyInternal
          ) {
            details.message =
              "Connection target service was experiencing internal errors";
          } else if (record.errorCode === ArticleDeliveryErrorCode.Internal) {
            details.message = "Internal error";
          } else if (
            record.errorCode === ArticleDeliveryErrorCode.ArticleProcessingError
          ) {
            details.message =
              "Failed to parse article content with current configuration";
            try {
              if (record.externalDetail) {
                details.data = JSON.parse(record.externalDetail)?.message;
              }
            } catch {}
          }
        } else if (record.status === ArticleDeliveryStatus.Failed) {
          status = DeliveryLogStatus.FAILED;
        } else if (record.status === ArticleDeliveryStatus.PendingDelivery) {
          status = DeliveryLogStatus.PENDING_DELIVERY;
        } else if (record.status === ArticleDeliveryStatus.RateLimited) {
          status = DeliveryLogStatus.ARTICLE_RATE_LIMITED;
        } else if (
          record.status === ArticleDeliveryStatus.MediumRateLimitedByUser
        ) {
          status = DeliveryLogStatus.MEDIUM_RATE_LIMITED;
        } else if (record.status === ArticleDeliveryStatus.FilteredOut) {
          status = DeliveryLogStatus.FILTERED_OUT;
          try {
            if (record.externalDetail) {
              details.data = JSON.parse(record.externalDetail);
            }
          } catch {}
        } else {
          throw new Error(
            `Unhandled article delivery status: ${record.status} for record: ${record.id}`
          );
        }

        return {
          id: record.id,
          mediumId: record.mediumId,
          createdAt: record.createdAt.toISOString(),
          details,
          articleIdHash: record.articleIdHash,
          status,
          articleData: record.articleData,
        };
      });
    },
  };

  return store;
}

/**
 * Default in-memory delivery record store singleton.
 */
export const inMemoryDeliveryRecordStore = createInMemoryDeliveryRecordStore();

/**
 * Clear the default in-memory delivery records (for testing).
 */
export function clearDeliveryRecordStore(): void {
  inMemoryDeliveryRecordStore._clear();
}

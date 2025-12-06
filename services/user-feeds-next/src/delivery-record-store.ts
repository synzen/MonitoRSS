import { AsyncLocalStorage } from "node:async_hooks";
import type { Article } from "./article-parser";

// ============================================================================
// Types (matching user-feeds exactly)
// ============================================================================

/**
 * Status of an article delivery.
 * Values match user-feeds exactly for database compatibility.
 */
export enum ArticleDeliveryStatus {
  PendingDelivery = "pending-delivery",
  Sent = "sent",
  Failed = "failed",
  Rejected = "rejected",
  FilteredOut = "filtered-out",
  RateLimited = "rate-limited",
  MediumRateLimitedByUser = "medium-rate-limited-by-user",
}

/**
 * Error codes for article delivery failures.
 */
export enum ArticleDeliveryErrorCode {
  Internal = "user-feeds/internal-error",
  NoChannelOrWebhook = "user-feeds/no-channel-or-webhook",
  ThirdPartyInternal = "user-feeds/third-party-internal",
  ThirdPartyBadRequest = "user-feeds/third-party-bad-request",
  ThirdPartyForbidden = "user-feeds/third-party-forbidden",
  ThirdPartyNotFound = "user-feeds/third-party-not-found",
  ArticleProcessingError = "user-feeds/article-processing-error",
}

/**
 * Content type for delivery records.
 */
export enum ArticleDeliveryContentType {
  DiscordArticleMessage = "discord-article-message",
  DiscordThreadCreation = "discord-thread-creation",
}

/**
 * Base interface for all delivery states.
 */
interface BaseArticleDeliveryState {
  id: string;
  mediumId: string;
  articleIdHash: string;
  article: Article | null;
}

interface ArticleDeliveryPendingDeliveryState extends BaseArticleDeliveryState {
  contentType: ArticleDeliveryContentType;
  status: ArticleDeliveryStatus.PendingDelivery;
  parent?: string;
}

interface ArticleDeliverySentState extends BaseArticleDeliveryState {
  status: ArticleDeliveryStatus.Sent;
  contentType?: ArticleDeliveryContentType;
  parent?: string;
}

interface ArticleDeliveryRateLimitState extends BaseArticleDeliveryState {
  status: ArticleDeliveryStatus.RateLimited;
  parent?: string;
}

interface ArticleDeliveryMediumRateLimitedState extends BaseArticleDeliveryState {
  status: ArticleDeliveryStatus.MediumRateLimitedByUser;
  parent?: string;
}

interface ArticleDeliveryRejectedState extends BaseArticleDeliveryState {
  status: ArticleDeliveryStatus.Rejected;
  contentType?: ArticleDeliveryContentType;
  errorCode: ArticleDeliveryErrorCode;
  externalDetail: string;
  internalMessage: string;
  parent?: string;
}

interface ArticleDeliveryFailureState extends BaseArticleDeliveryState {
  status: ArticleDeliveryStatus.Failed;
  errorCode: ArticleDeliveryErrorCode;
  internalMessage: string;
  parent?: string;
}

interface ArticleDeliveryFilteredOutState extends BaseArticleDeliveryState {
  status: ArticleDeliveryStatus.FilteredOut;
  externalDetail: string | null;
  parent?: string;
}

/**
 * Union type of all delivery states (matches user-feeds ArticleDeliveryState).
 */
export type ArticleDeliveryState =
  | ArticleDeliveryPendingDeliveryState
  | ArticleDeliverySentState
  | ArticleDeliveryFailureState
  | ArticleDeliveryFilteredOutState
  | ArticleDeliveryRejectedState
  | ArticleDeliveryRateLimitState
  | ArticleDeliveryMediumRateLimitedState;

/**
 * Insert record for partitioned delivery table (matches user-feeds).
 */
export interface PartitionedDeliveryRecordInsert {
  id: string;
  feedId: string;
  mediumId: string;
  createdAt: Date;
  status: ArticleDeliveryStatus;
  contentType: ArticleDeliveryContentType | null;
  parentId: string | null;
  internalMessage: string | null;
  errorCode: string | null;
  externalDetail: string | null;
  articleId: string | null;
  articleIdHash: string | null;
  articleData: Record<string, string> | null;
}

// ============================================================================
// AsyncLocalStorage Context
// ============================================================================

interface DeliveryRecordAsyncStore {
  toInsert: PartitionedDeliveryRecordInsert[];
}

const asyncLocalStorage = new AsyncLocalStorage<DeliveryRecordAsyncStore>();

// ============================================================================
// Delivery Record Store Interface
// ============================================================================

/**
 * Interface for delivery record storage.
 * Matches the behavior of user-feeds DeliveryRecordService.
 */
export interface DeliveryRecordStore {
  /**
   * Start a context for batched inserts.
   */
  startContext<T>(cb: () => Promise<T>): Promise<T>;

  /**
   * Store delivery states. If flush=true, immediately persist.
   * If flush=false, add to pending inserts for later flush.
   */
  store(
    feedId: string,
    articleStates: ArticleDeliveryState[],
    flush?: boolean
  ): Promise<{ inserted: number } | undefined>;

  /**
   * Flush all pending inserts to the store.
   */
  flushPendingInserts(): Promise<{ affectedRows: number }>;

  /**
   * Update the status of a delivery record.
   */
  updateDeliveryStatus(
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
  }>;

  /**
   * Count deliveries with "sent" status in a time window.
   * Used for rate limiting.
   */
  countDeliveriesInPastTimeframe(
    filter: { mediumId?: string; feedId?: string },
    secondsInPast: number
  ): Promise<number>;
}

// ============================================================================
// In-Memory Delivery Record Store
// ============================================================================

// Storage for persisted records
const deliveryRecords = new Map<string, PartitionedDeliveryRecordInsert>();

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

/**
 * Generate a unique delivery ID.
 * Matches the format used in user-feeds.
 */
export function generateDeliveryId(): string {
  return crypto.randomUUID();
}

/**
 * Convert an ArticleDeliveryResult to an ArticleDeliveryState.
 * This bridges the gap between the simple result format and the full state format.
 */
export function resultToState(
  result: {
    status: ArticleDeliveryStatus;
    article: {
      flattened: { id: string; idHash: string; title?: string };
      raw: Record<string, unknown>;
    };
    mediumId: string;
    message?: string;
    errorCode?: ArticleDeliveryErrorCode;
    externalDetail?: string;
  },
  id?: string
): ArticleDeliveryState {
  const deliveryId = id ?? generateDeliveryId();

  switch (result.status) {
    case ArticleDeliveryStatus.Sent:
      return {
        id: deliveryId,
        status: ArticleDeliveryStatus.Sent,
        mediumId: result.mediumId,
        articleIdHash: result.article.flattened.idHash,
        article: result.article,
      };

    case ArticleDeliveryStatus.Failed:
      return {
        id: deliveryId,
        status: ArticleDeliveryStatus.Failed,
        mediumId: result.mediumId,
        articleIdHash: result.article.flattened.idHash,
        article: result.article,
        errorCode: result.errorCode ?? ArticleDeliveryErrorCode.Internal,
        internalMessage: result.message ?? "Unknown error",
      };

    case ArticleDeliveryStatus.Rejected:
      return {
        id: deliveryId,
        status: ArticleDeliveryStatus.Rejected,
        mediumId: result.mediumId,
        articleIdHash: result.article.flattened.idHash,
        article: result.article,
        errorCode: result.errorCode ?? ArticleDeliveryErrorCode.Internal,
        internalMessage: result.message ?? "Unknown error",
        externalDetail: result.externalDetail ?? "",
      };

    case ArticleDeliveryStatus.FilteredOut:
      return {
        id: deliveryId,
        status: ArticleDeliveryStatus.FilteredOut,
        mediumId: result.mediumId,
        articleIdHash: result.article.flattened.idHash,
        article: result.article,
        externalDetail: result.externalDetail ?? null,
      };

    case ArticleDeliveryStatus.RateLimited:
      return {
        id: deliveryId,
        status: ArticleDeliveryStatus.RateLimited,
        mediumId: result.mediumId,
        articleIdHash: result.article.flattened.idHash,
        article: result.article,
      };

    case ArticleDeliveryStatus.MediumRateLimitedByUser:
      return {
        id: deliveryId,
        status: ArticleDeliveryStatus.MediumRateLimitedByUser,
        mediumId: result.mediumId,
        articleIdHash: result.article.flattened.idHash,
        article: result.article,
      };

    case ArticleDeliveryStatus.PendingDelivery:
      return {
        id: deliveryId,
        status: ArticleDeliveryStatus.PendingDelivery,
        mediumId: result.mediumId,
        articleIdHash: result.article.flattened.idHash,
        article: result.article,
        contentType: ArticleDeliveryContentType.DiscordArticleMessage,
      };

    default:
      // Fallback for any unhandled status
      return {
        id: deliveryId,
        status: ArticleDeliveryStatus.Sent,
        mediumId: result.mediumId,
        articleIdHash: result.article.flattened.idHash,
        article: result.article,
      };
  }
}

import type { Article } from "../../articles/parser";

// ============================================================================
// Delivery Log Status (matches user-feeds DeliveryLogStatus)
// ============================================================================

export enum DeliveryLogStatus {
  DELIVERED = "DELIVERED",
  PENDING_DELIVERY = "PENDING_DELIVERY",
  FAILED = "FAILED",
  REJECTED = "REJECTED",
  FILTERED_OUT = "FILTERED_OUT",
  MEDIUM_RATE_LIMITED = "MEDIUM_RATE_LIMITED",
  ARTICLE_RATE_LIMITED = "ARTICLE_RATE_LIMITED",
  PARTIALLY_DELIVERED = "PARTIALLY_DELIVERED",
}

/**
 * Delivery log entry for API response.
 */
export interface DeliveryLog {
  id: string;
  mediumId: string;
  createdAt: string;
  status: DeliveryLogStatus;
  articleIdHash?: string | null;
  details?: {
    message?: string;
    data?: Record<string, unknown>;
  };
  articleData: Record<string, string> | null;
}

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

  /**
   * Get delivery logs for a feed.
   * Used by the HTTP API.
   */
  getDeliveryLogs(options: {
    feedId: string;
    skip: number;
    limit: number;
  }): Promise<DeliveryLog[]>;
}

/**
 * Generate a unique delivery ID.
 * Matches the format used in user-feeds.
 */
export function generateDeliveryId(): string {
  return crypto.randomUUID();
}

import { FeedRejectedDisabledCode, MessageBrokerQueue } from "../../shared/constants";

/**
 * Retry record for a feed that has failed to parse.
 */
export interface FeedRetryRecord {
  /**
   * Number of retry attempts so far.
   */
  attempts_so_far: number;
  /**
   * When the first failure occurred.
   */
  created_at: Date;
}

/**
 * Store interface for managing feed retry records.
 */
export interface FeedRetryStore {
  /**
   * Get the retry record for a feed.
   */
  get(feedId: string): Promise<FeedRetryRecord | null>;

  /**
   * Create or update a retry record for a feed.
   */
  upsert(
    feedId: string,
    record: { attempts_so_far: number; created_at: Date }
  ): Promise<void>;

  /**
   * Remove the retry record for a feed.
   */
  remove(feedId: string): Promise<void>;
}

/**
 * Publisher interface for sending messages to the message broker.
 */
export interface FeedRetryPublisher {
  publish(
    queue: MessageBrokerQueue,
    message: { feed_id: string; disabled_code: FeedRejectedDisabledCode }
  ): Promise<void>;
}

/**
 * Maximum number of retry attempts before disabling the feed.
 */
export const MAX_RETRY_ATTEMPTS = 8;

/**
 * Number of days after which to disable a feed if it's still failing.
 */
export const RETRY_CUTOFF_DAYS = 1;

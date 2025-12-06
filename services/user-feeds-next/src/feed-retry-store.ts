import dayjs from "dayjs";
import { FeedRejectedDisabledCode, MessageBrokerQueue } from "./constants";

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
 * In-memory implementation of FeedRetryStore for testing and development.
 */
export function createInMemoryFeedRetryStore(): FeedRetryStore {
  const store = new Map<string, FeedRetryRecord>();

  return {
    async get(feedId: string): Promise<FeedRetryRecord | null> {
      return store.get(feedId) ?? null;
    },

    async upsert(
      feedId: string,
      record: { attempts_so_far: number; created_at: Date }
    ): Promise<void> {
      store.set(feedId, {
        attempts_so_far: record.attempts_so_far,
        created_at: record.created_at,
      });
    },

    async remove(feedId: string): Promise<void> {
      store.delete(feedId);
    },
  };
}

/**
 * Singleton in-memory retry store instance.
 */
export const inMemoryFeedRetryStore = createInMemoryFeedRetryStore();

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

/**
 * Handle a feed parse failure by tracking retries and potentially disabling the feed.
 *
 * Retry logic:
 * - If this is the first failure, create a retry record
 * - If the feed has been failing for more than RETRY_CUTOFF_DAYS, disable it
 * - If the feed has reached MAX_RETRY_ATTEMPTS, disable it
 * - Otherwise, increment the attempt counter
 *
 * @param feedId - The ID of the feed that failed
 * @param store - The retry store to use
 * @param publisher - The publisher to send disable messages
 * @returns Whether the feed was disabled
 */
export async function handleFeedParseFailure({
  feedId,
  store,
  publisher,
}: {
  feedId: string;
  store: FeedRetryStore;
  publisher: FeedRetryPublisher;
}): Promise<{ disabled: boolean }> {
  const existingRecord = await store.get(feedId);

  if (!existingRecord) {
    // First failure - create a new retry record
    await store.upsert(feedId, {
      attempts_so_far: 1,
      created_at: new Date(),
    });
    return { disabled: false };
  }

  const now = dayjs();
  const createdAt = dayjs(existingRecord.created_at);
  const daysSinceFirstFailure = now.diff(createdAt, "day");

  // Check if we should disable the feed
  const shouldDisable =
    daysSinceFirstFailure >= RETRY_CUTOFF_DAYS ||
    existingRecord.attempts_so_far >= MAX_RETRY_ATTEMPTS;

  if (shouldDisable) {
    // Publish disable event and remove retry record
    await publisher.publish(MessageBrokerQueue.FeedRejectedDisableFeed, {
      feed_id: feedId,
      disabled_code: FeedRejectedDisabledCode.InvalidFeed,
    });
    await store.remove(feedId);
    return { disabled: true };
  }

  // Increment attempt counter
  await store.upsert(feedId, {
    attempts_so_far: existingRecord.attempts_so_far + 1,
    created_at: existingRecord.created_at,
  });

  return { disabled: false };
}

/**
 * Handle a successful feed parse by clearing any retry records.
 *
 * @param feedId - The ID of the feed that was successfully parsed
 * @param store - The retry store to use
 */
export async function handleFeedParseSuccess({
  feedId,
  store,
}: {
  feedId: string;
  store: FeedRetryStore;
}): Promise<void> {
  await store.remove(feedId);
}

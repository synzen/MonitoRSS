import dayjs from "dayjs";
import { FeedRejectedDisabledCode, MessageBrokerQueue } from "../../shared/constants";
import {
  type FeedRetryStore,
  type FeedRetryRecord,
  type FeedRetryPublisher,
  MAX_RETRY_ATTEMPTS,
  RETRY_CUTOFF_DAYS,
} from "../interfaces/feed-retry-store";

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

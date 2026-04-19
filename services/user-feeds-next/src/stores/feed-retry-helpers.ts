import dayjs from "dayjs";
import { FeedRejectedDisabledCode, MessageBrokerQueue } from "../shared/constants";
import {
  type FeedRetryStore,
  type FeedRetryPublisher,
  MAX_RETRY_ATTEMPTS,
  RETRY_CUTOFF_DAYS,
} from "./interfaces/feed-retry-store";

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
    await store.upsert(feedId, {
      attempts_so_far: 1,
      created_at: new Date(),
    });
    return { disabled: false };
  }

  const now = dayjs();
  const createdAt = dayjs(existingRecord.created_at);
  const daysSinceFirstFailure = now.diff(createdAt, "day");

  const shouldDisable =
    daysSinceFirstFailure >= RETRY_CUTOFF_DAYS ||
    existingRecord.attempts_so_far >= MAX_RETRY_ATTEMPTS;

  if (shouldDisable) {
    await publisher.publish(MessageBrokerQueue.FeedRejectedDisableFeed, {
      feed_id: feedId,
      disabled_code: FeedRejectedDisabledCode.InvalidFeed,
    });
    await store.remove(feedId);
    return { disabled: true };
  }

  await store.upsert(feedId, {
    attempts_so_far: existingRecord.attempts_so_far + 1,
    created_at: existingRecord.created_at,
  });

  return { disabled: false };
}

export async function handleFeedParseSuccess({
  feedId,
  store,
}: {
  feedId: string;
  store: FeedRetryStore;
}): Promise<void> {
  await store.remove(feedId);
}

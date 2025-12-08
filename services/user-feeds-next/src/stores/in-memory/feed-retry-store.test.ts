import { describe, it, expect, beforeEach, mock } from "bun:test";
import dayjs from "dayjs";
import {
  createInMemoryFeedRetryStore,
  handleFeedParseFailure,
  handleFeedParseSuccess,
} from "./feed-retry-store";
import {
  MAX_RETRY_ATTEMPTS,
  RETRY_CUTOFF_DAYS,
  type FeedRetryStore,
  type FeedRetryPublisher,
} from "../interfaces/feed-retry-store";
import { MessageBrokerQueue, FeedRejectedDisabledCode } from "../../shared/constants";

describe("Feed Retry Store", () => {
  describe("createInMemoryFeedRetryStore", () => {
    let store: FeedRetryStore;

    beforeEach(() => {
      store = createInMemoryFeedRetryStore();
    });

    it("should return null for non-existent feed", async () => {
      const result = await store.get("non-existent-feed");
      expect(result).toBeNull();
    });

    it("should store and retrieve a retry record", async () => {
      const feedId = "test-feed-1";
      const createdAt = new Date("2024-01-15T12:00:00Z");

      await store.upsert(feedId, {
        attempts_so_far: 3,
        created_at: createdAt,
      });

      const result = await store.get(feedId);
      expect(result).toEqual({
        attempts_so_far: 3,
        created_at: createdAt,
      });
    });

    it("should update an existing retry record", async () => {
      const feedId = "test-feed-2";
      const createdAt = new Date("2024-01-15T12:00:00Z");

      await store.upsert(feedId, {
        attempts_so_far: 1,
        created_at: createdAt,
      });

      await store.upsert(feedId, {
        attempts_so_far: 5,
        created_at: createdAt,
      });

      const result = await store.get(feedId);
      expect(result?.attempts_so_far).toBe(5);
    });

    it("should remove a retry record", async () => {
      const feedId = "test-feed-3";

      await store.upsert(feedId, {
        attempts_so_far: 2,
        created_at: new Date(),
      });

      await store.remove(feedId);
      const result = await store.get(feedId);
      expect(result).toBeNull();
    });

    it("should handle removing non-existent record gracefully", async () => {
      await expect(store.remove("non-existent")).resolves.toBeUndefined();
    });

    it("should store multiple feeds independently", async () => {
      const feedId1 = "feed-a";
      const feedId2 = "feed-b";
      const date1 = new Date("2024-01-10T00:00:00Z");
      const date2 = new Date("2024-01-12T00:00:00Z");

      await store.upsert(feedId1, { attempts_so_far: 2, created_at: date1 });
      await store.upsert(feedId2, { attempts_so_far: 7, created_at: date2 });

      const result1 = await store.get(feedId1);
      const result2 = await store.get(feedId2);

      expect(result1?.attempts_so_far).toBe(2);
      expect(result2?.attempts_so_far).toBe(7);
    });
  });

  describe("handleFeedParseFailure", () => {
    let store: FeedRetryStore;
    let publisher: FeedRetryPublisher;
    let publishedMessages: Array<{
      queue: MessageBrokerQueue;
      message: { feed_id: string; disabled_code: FeedRejectedDisabledCode };
    }>;

    beforeEach(() => {
      store = createInMemoryFeedRetryStore();
      publishedMessages = [];
      publisher = {
        publish: async (queue, message) => {
          publishedMessages.push({ queue, message });
        },
      };
    });

    it("should create a new retry record on first failure", async () => {
      const feedId = "new-failing-feed";

      const result = await handleFeedParseFailure({
        feedId,
        store,
        publisher,
      });

      expect(result.disabled).toBe(false);
      expect(publishedMessages).toHaveLength(0);

      const record = await store.get(feedId);
      expect(record).not.toBeNull();
      expect(record?.attempts_so_far).toBe(1);
    });

    it("should increment attempts on subsequent failures", async () => {
      const feedId = "incrementing-feed";
      const createdAt = new Date();

      // Simulate first failure (or pre-seed the store)
      await store.upsert(feedId, {
        attempts_so_far: 3,
        created_at: createdAt,
      });

      const result = await handleFeedParseFailure({
        feedId,
        store,
        publisher,
      });

      expect(result.disabled).toBe(false);

      const record = await store.get(feedId);
      expect(record?.attempts_so_far).toBe(4);
      expect(record?.created_at).toEqual(createdAt);
    });

    it("should disable feed after MAX_RETRY_ATTEMPTS failures", async () => {
      const feedId = "max-attempts-feed";

      // Set up record at MAX_RETRY_ATTEMPTS
      await store.upsert(feedId, {
        attempts_so_far: MAX_RETRY_ATTEMPTS,
        created_at: new Date(),
      });

      const result = await handleFeedParseFailure({
        feedId,
        store,
        publisher,
      });

      expect(result.disabled).toBe(true);
      expect(publishedMessages).toHaveLength(1);

      const message = publishedMessages[0]!;
      expect(message.queue).toBe(MessageBrokerQueue.FeedRejectedDisableFeed);
      expect(message.message).toEqual({
        feed_id: feedId,
        disabled_code: FeedRejectedDisabledCode.InvalidFeed,
      });

      // Record should be removed after disabling
      const record = await store.get(feedId);
      expect(record).toBeNull();
    });

    it("should disable feed after RETRY_CUTOFF_DAYS days", async () => {
      const feedId = "old-failing-feed";

      // Set up record from RETRY_CUTOFF_DAYS ago
      const oldDate = dayjs()
        .subtract(RETRY_CUTOFF_DAYS, "day")
        .subtract(1, "hour")
        .toDate();

      await store.upsert(feedId, {
        attempts_so_far: 2, // Low attempt count but old
        created_at: oldDate,
      });

      const result = await handleFeedParseFailure({
        feedId,
        store,
        publisher,
      });

      expect(result.disabled).toBe(true);
      expect(publishedMessages).toHaveLength(1);
      expect(publishedMessages[0]!.queue).toBe(
        MessageBrokerQueue.FeedRejectedDisableFeed
      );
    });

    it("should not disable feed if within cutoff and under max attempts", async () => {
      const feedId = "healthy-retry-feed";

      // Recent failure, low attempts
      await store.upsert(feedId, {
        attempts_so_far: 3,
        created_at: new Date(),
      });

      const result = await handleFeedParseFailure({
        feedId,
        store,
        publisher,
      });

      expect(result.disabled).toBe(false);
      expect(publishedMessages).toHaveLength(0);
    });

    it("should disable at exactly MAX_RETRY_ATTEMPTS", async () => {
      const feedId = "exact-max-feed";

      await store.upsert(feedId, {
        attempts_so_far: MAX_RETRY_ATTEMPTS, // Exactly at threshold
        created_at: new Date(),
      });

      const result = await handleFeedParseFailure({
        feedId,
        store,
        publisher,
      });

      expect(result.disabled).toBe(true);
    });

    it("should not disable at MAX_RETRY_ATTEMPTS - 1", async () => {
      const feedId = "just-under-max-feed";

      await store.upsert(feedId, {
        attempts_so_far: MAX_RETRY_ATTEMPTS - 1,
        created_at: new Date(),
      });

      const result = await handleFeedParseFailure({
        feedId,
        store,
        publisher,
      });

      expect(result.disabled).toBe(false);
    });
  });

  describe("handleFeedParseSuccess", () => {
    let store: FeedRetryStore;

    beforeEach(() => {
      store = createInMemoryFeedRetryStore();
    });

    it("should remove retry record on success", async () => {
      const feedId = "recovered-feed";

      await store.upsert(feedId, {
        attempts_so_far: 5,
        created_at: new Date(),
      });

      await handleFeedParseSuccess({
        feedId,
        store,
      });

      const record = await store.get(feedId);
      expect(record).toBeNull();
    });

    it("should handle success for feed with no retry record", async () => {
      const feedId = "always-healthy-feed";

      // Should not throw
      await expect(
        handleFeedParseSuccess({
          feedId,
          store,
        })
      ).resolves.toBeUndefined();
    });

    it("should only remove the specific feed's record", async () => {
      const feedId1 = "success-feed";
      const feedId2 = "still-failing-feed";

      await store.upsert(feedId1, {
        attempts_so_far: 3,
        created_at: new Date(),
      });
      await store.upsert(feedId2, {
        attempts_so_far: 5,
        created_at: new Date(),
      });

      await handleFeedParseSuccess({ feedId: feedId1, store });

      expect(await store.get(feedId1)).toBeNull();
      expect(await store.get(feedId2)).not.toBeNull();
    });
  });
});

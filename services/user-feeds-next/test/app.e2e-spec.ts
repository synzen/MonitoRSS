import { test, expect, describe } from "bun:test";
import { parseFeedV2Event } from "../src/feed-event-handler";
import { FeedResponseRequestStatus } from "../src/feed-fetcher";

describe("user-feeds-next e2e", () => {
  describe("parseFeedV2Event", () => {
    test("returns null for invalid event", () => {
      expect(parseFeedV2Event({})).toBe(null);
    });

    test("returns null for empty data object", () => {
      expect(parseFeedV2Event({ data: {} })).toBe(null);
    });

    test("parses valid event", () => {
      const validEvent = {
        timestamp: Date.now(),
        data: {
          feed: {
            id: "test-feed-id",
            url: "https://example.com/feed.xml",
            passingComparisons: [],
            blockingComparisons: [],
          },
          mediums: [
            {
              id: "medium-1",
              key: "discord",
              details: {
                guildId: "123456789",
                components: null,
                content: "Test content",
                embeds: [],
              },
            },
          ],
          articleDayLimit: 1,
        },
      };

      const result = parseFeedV2Event(validEvent);
      expect(result).not.toBe(null);
      expect(result?.data.feed.id).toBe("test-feed-id");
      expect(result?.data.feed.url).toBe("https://example.com/feed.xml");
    });
  });

  describe("FeedResponseRequestStatus", () => {
    test("has correct enum values", () => {
      expect(FeedResponseRequestStatus.Success).toBe(
        FeedResponseRequestStatus.Success
      );
      expect(FeedResponseRequestStatus.Pending).toBe(
        FeedResponseRequestStatus.Pending
      );
      expect(FeedResponseRequestStatus.MatchedHash).toBe(
        FeedResponseRequestStatus.MatchedHash
      );
      expect(FeedResponseRequestStatus.InternalError).toBe(
        FeedResponseRequestStatus.InternalError
      );
    });
  });
});

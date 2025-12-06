import type { SQL } from "bun";
import type { FeedRetryStore, FeedRetryRecord } from "../feed-retry-store";

/**
 * Create a PostgreSQL-backed implementation of FeedRetryStore.
 * Uses Bun's native SQL module.
 */
export function createPostgresFeedRetryStore(sql: SQL): FeedRetryStore {
  return {
    async get(feedId: string): Promise<FeedRetryRecord | null> {
      const [result] = await sql`
        SELECT attempts_so_far, created_at
        FROM feed_retry_record
        WHERE feed_id = ${feedId}
        LIMIT 1
      `;

      if (!result) {
        return null;
      }

      return {
        attempts_so_far: result.attempts_so_far as number,
        created_at: result.created_at as Date,
      };
    },

    async upsert(
      feedId: string,
      record: { attempts_so_far: number; created_at: Date }
    ): Promise<void> {
      await sql`
        INSERT INTO feed_retry_record (feed_id, attempts_so_far, created_at)
        VALUES (${feedId}, ${record.attempts_so_far}, ${record.created_at})
        ON CONFLICT (feed_id) DO UPDATE SET
          attempts_so_far = ${record.attempts_so_far},
          created_at = ${record.created_at}
      `;
    },

    async remove(feedId: string): Promise<void> {
      await sql`
        DELETE FROM feed_retry_record
        WHERE feed_id = ${feedId}
      `;
    },
  };
}

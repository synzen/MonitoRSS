import type { Pool } from "pg";
import type {
  FeedRetryStore,
  FeedRetryRecord,
} from "../interfaces/feed-retry-store";

export function createPostgresFeedRetryStore(pool: Pool): FeedRetryStore {
  return {
    async get(feedId: string): Promise<FeedRetryRecord | null> {
      const { rows } = await pool.query(
        `SELECT attempts_so_far, created_at FROM feed_retry_record WHERE feed_id = $1 LIMIT 1`,
        [feedId]
      );

      if (!rows[0]) {
        return null;
      }

      return {
        attempts_so_far: rows[0].attempts_so_far as number,
        created_at: rows[0].created_at as Date,
      };
    },

    async upsert(
      feedId: string,
      record: { attempts_so_far: number; created_at: Date }
    ): Promise<void> {
      await pool.query(
        `INSERT INTO feed_retry_record (feed_id, attempts_so_far, created_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (feed_id) DO UPDATE SET attempts_so_far = $2, created_at = $3`,
        [feedId, record.attempts_so_far, record.created_at]
      );
    },

    async remove(feedId: string): Promise<void> {
      await pool.query(`DELETE FROM feed_retry_record WHERE feed_id = $1`, [
        feedId,
      ]);
    },
  };
}

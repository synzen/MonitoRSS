import type { Pool } from "pg";
import type { ResponseHashStore } from "../../feeds/feed-event-handler";
import { logger } from "../../shared/utils";

export function createPostgresResponseHashStore(pool: Pool): ResponseHashStore {
  return {
    async get(feedId: string): Promise<string | null> {
      const { rows } = await pool.query(
        `SELECT hash FROM response_hash WHERE feed_id = $1 LIMIT 1`,
        [feedId]
      );
      return (rows[0]?.hash as string) ?? null;
    },

    async set(feedId: string, hash: string): Promise<void> {
      if (!hash) {
        throw new Error("Hash is required");
      }

      try {
        const now = new Date();
        await pool.query(
          `INSERT INTO response_hash (feed_id, hash, updated_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (feed_id) DO UPDATE SET hash = $2, updated_at = $3`,
          [feedId, hash, now]
        );
      } catch (err) {
        logger.error(`Failed to set in cache storage`, {
          err: (err as Error).stack,
          feedId,
        });
      }
    },

    async remove(feedId: string): Promise<void> {
      await pool.query(`DELETE FROM response_hash WHERE feed_id = $1`, [
        feedId,
      ]);
    },
  };
}

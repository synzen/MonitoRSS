import type { SQL } from "bun";
import type { ResponseHashStore } from "../feed-event-handler";
import { logger } from "../utils";

/**
 * Create a PostgreSQL-backed implementation of ResponseHashStore.
 * Uses Bun's native SQL module.
 */
export function createPostgresResponseHashStore(sql: SQL): ResponseHashStore {
  return {
    async get(feedId: string): Promise<string | null> {
      const [result] = await sql`
        SELECT hash
        FROM response_hash
        WHERE feed_id = ${feedId}
        LIMIT 1
      `;
      return (result?.hash as string) ?? null;
    },

    async set(feedId: string, hash: string): Promise<void> {
      if (!hash) {
        throw new Error("Hash is required");
      }

      try {
        await sql`
          INSERT INTO response_hash (feed_id, hash, updated_at)
          VALUES (${feedId}, ${hash}, ${new Date()})
          ON CONFLICT (feed_id) DO UPDATE SET
            hash = ${hash},
            updated_at = ${new Date()}
        `;
      } catch (err) {
        logger.error(`Failed to set in cache storage`, {
          err: (err as Error).stack,
          feedId,
        });
      }
    },

    async remove(feedId: string): Promise<void> {
      await sql`
        DELETE FROM response_hash
        WHERE feed_id = ${feedId}
      `;
    },
  };
}

import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "crypto";
import dayjs from "dayjs";
import type { Pool } from "pg";
import type {
  ArticleFieldStore,
  PendingArticleFieldInsert,
} from "../../articles/comparison";
import type { Article } from "../../articles/parser";
import { logger } from "../../shared/utils";

const TABLE_NAME = "feed_article_field_partitioned";

interface AsyncStore {
  pendingInserts: PendingArticleFieldInsert[];
}

const asyncLocalStorage = new AsyncLocalStorage<AsyncStore>();

export function createPostgresArticleFieldStore(pool: Pool): ArticleFieldStore {
  return {
    async hasPriorArticlesStored(feedId: string): Promise<boolean> {
      const { rows } = await pool.query(
        `SELECT 1 AS result FROM feed_article_field_partitioned WHERE feed_id = $1 LIMIT 1`,
        [feedId]
      );
      return !!rows[0];
    },

    async findStoredArticleIds(
      feedId: string,
      idHashes: string[]
    ): Promise<Set<string>> {
      if (idHashes.length === 0) {
        return new Set();
      }

      const placeholders = idHashes.map((_, i) => `$${i + 2}`).join(", ");
      const { rows } = await pool.query(
        `SELECT field_hashed_value FROM feed_article_field_partitioned
         WHERE feed_id = $1 AND field_name = 'id' AND field_hashed_value IN (${placeholders})`,
        [feedId, ...idHashes]
      );

      return new Set(rows.map((r) => r.field_hashed_value as string));
    },

    async findStoredArticleIdsPartitioned(
      feedId: string,
      idHashes: string[],
      olderThanOneMonth: boolean
    ): Promise<Set<string>> {
      if (idHashes.length === 0) {
        return new Set();
      }

      const oneMonthAgo = dayjs().subtract(1, "month").toDate();
      const dateCondition = olderThanOneMonth
        ? "created_at <= $2"
        : "created_at > $2";

      let rows: Array<{ field_hashed_value: string }>;

      if (idHashes.length < 15) {
        const placeholders = idHashes.map((_, i) => `$${i + 3}`).join(", ");
        const result = await pool.query(
          `SELECT field_hashed_value FROM feed_article_field_partitioned
           WHERE ${dateCondition} AND feed_id = $1 AND field_name = 'id'
             AND field_hashed_value IN (${placeholders})`,
          [feedId, oneMonthAgo, ...idHashes]
        );
        rows = result.rows;
      } else {
        // Use transaction with temporary table for large ID sets
        const temporaryTableName = `current_article_ids_${feedId.replace(/-/g, "_")}`;
        const client = await pool.connect();

        try {
          await client.query("BEGIN");

          const placeholders = idHashes.map((_, i) => `($${i + 1})`).join(", ");
          await client.query(
            `CREATE TEMP TABLE ${temporaryTableName} AS SELECT * FROM (VALUES ${placeholders}) AS t(id)`,
            idHashes
          );

          const result = await client.query(
            `SELECT field_hashed_value FROM feed_article_field_partitioned
             INNER JOIN ${temporaryTableName} t ON (field_hashed_value = t.id)
             WHERE ${dateCondition} AND feed_id = $1 AND field_name = 'id'`,
            [feedId, oneMonthAgo]
          );
          rows = result.rows;

          await client.query(`DROP TABLE ${temporaryTableName}`);
          await client.query("COMMIT");
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        } finally {
          client.release();
        }
      }

      return new Set(rows.map((r) => r.field_hashed_value));
    },

    async someFieldsExist(
      feedId: string,
      fields: Array<{ name: string; hashedValue: string }>
    ): Promise<boolean> {
      if (fields.length === 0) {
        return false;
      }

      const conditions = fields
        .map(
          (_, i) =>
            `(field_name = $${i * 2 + 2} AND field_hashed_value = $${i * 2 + 3})`
        )
        .join(" OR ");

      const params = [
        feedId,
        ...fields.flatMap((f) => [f.name, f.hashedValue]),
      ];

      const { rows } = await pool.query(
        `SELECT 1 FROM ${TABLE_NAME} WHERE feed_id = $1 AND (${conditions}) LIMIT 1`,
        params
      );

      return rows.length > 0;
    },

    async storeArticles(
      feedId: string,
      articles: Article[],
      comparisonFields: string[]
    ): Promise<void> {
      const store = asyncLocalStorage.getStore();

      if (!store) {
        throw new Error(
          "No context was started for ArticleFieldStore. " +
            "Call storeArticles within a startContext callback."
        );
      }

      const now = new Date();
      const { pendingInserts } = store;

      for (const article of articles) {
        pendingInserts.push({
          feedId,
          fieldName: "id",
          hashedValue: article.flattened.idHash,
          createdAt: now,
        });

        for (const fieldName of comparisonFields) {
          const value = article.flattened[fieldName];
          if (value) {
            const hashedValue = createHash("sha1").update(value).digest("hex");
            pendingInserts.push({
              feedId,
              fieldName,
              hashedValue,
              createdAt: now,
            });
          }
        }
      }
    },

    async getStoredComparisonNames(feedId: string): Promise<Set<string>> {
      const { rows } = await pool.query(
        `SELECT field_name FROM feed_article_custom_comparison WHERE feed_id = $1`,
        [feedId]
      );

      return new Set(rows.map((r) => r.field_name as string));
    },

    async storeComparisonNames(
      feedId: string,
      comparisonFields: string[]
    ): Promise<void> {
      for (const fieldName of comparisonFields) {
        try {
          await pool.query(
            `INSERT INTO feed_article_custom_comparison (feed_id, field_name, created_at)
             VALUES ($1, $2, $3)
             ON CONFLICT (feed_id, field_name) DO NOTHING`,
            [feedId, fieldName, new Date()]
          );
        } catch {
          // Ignore unique constraint violations
        }
      }
    },

    async clear(feedId: string): Promise<void> {
      await pool.query(
        `DELETE FROM feed_article_field_partitioned WHERE feed_id = $1`,
        [feedId]
      );
      await pool.query(
        `DELETE FROM feed_article_custom_comparison WHERE feed_id = $1`,
        [feedId]
      );
    },

    async startContext<T>(cb: () => Promise<T>): Promise<T> {
      return asyncLocalStorage.run({ pendingInserts: [] }, cb);
    },

    async flushPendingInserts(): Promise<{ affectedRows: number }> {
      const store = asyncLocalStorage.getStore();

      if (!store) {
        throw new Error("No context was started for ArticleFieldStore");
      }

      const { pendingInserts: inserts } = store;

      if (inserts.length === 0) {
        return { affectedRows: 0 };
      }

      try {
        const allValues = inserts.flatMap((r) => [
          r.feedId,
          r.fieldName,
          r.hashedValue,
          r.createdAt,
        ]);

        const placeholders = inserts
          .map((_, i) => {
            const base = i * 4;
            return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
          })
          .join(", ");

        const result = await pool.query(
          `INSERT INTO feed_article_field_partitioned
           (feed_id, field_name, field_hashed_value, created_at)
           VALUES ${placeholders}`,
          allValues
        );

        return { affectedRows: result.rowCount ?? 0 };
      } catch (err) {
        logger.error("Error inserting into feed_article_field_partitioned", {
          stack: (err as Error).stack,
        });
        throw err;
      } finally {
        store.pendingInserts = [];
      }
    },
  };
}

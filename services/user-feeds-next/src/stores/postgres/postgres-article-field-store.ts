import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "crypto";
import dayjs from "dayjs";
import type { SQL } from "bun";
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

/**
 * Create a PostgreSQL-backed implementation of ArticleFieldStore.
 * Uses Bun's native SQL module for partitioned table queries.
 */
export function createPostgresArticleFieldStore(sql: SQL): ArticleFieldStore {
  return {
    async hasPriorArticlesStored(feedId: string): Promise<boolean> {
      const [result] = await sql`
        SELECT 1 AS result FROM feed_article_field_partitioned
        WHERE feed_id = ${feedId}
        LIMIT 1
      `;
      return !!result;
    },

    async findStoredArticleIds(
      feedId: string,
      idHashes: string[]
    ): Promise<Set<string>> {
      if (idHashes.length === 0) {
        return new Set();
      }

      const results = await sql`
        SELECT field_hashed_value FROM feed_article_field_partitioned
        WHERE feed_id = ${feedId}
          AND field_name = 'id'
          AND field_hashed_value IN ${sql(idHashes)}
      `;

      return new Set(
        results.map((r: { field_hashed_value: string }) => r.field_hashed_value)
      );
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

      let results: Array<{ field_hashed_value: string }>;

      if (idHashes.length < 15) {
        // Simple query for small ID sets
        if (olderThanOneMonth) {
          results = await sql`
            SELECT field_hashed_value FROM feed_article_field_partitioned
            WHERE created_at <= ${oneMonthAgo}
              AND feed_id = ${feedId}
              AND field_name = 'id'
              AND field_hashed_value IN ${sql(idHashes)}
          `;
        } else {
          results = await sql`
            SELECT field_hashed_value FROM feed_article_field_partitioned
            WHERE created_at > ${oneMonthAgo}
              AND feed_id = ${feedId}
              AND field_name = 'id'
              AND field_hashed_value IN ${sql(idHashes)}
          `;
        }
      } else {
        // Use transaction with temporary table for large ID sets
        const temporaryTableName = `current_article_ids_${feedId.replace(/-/g, "_")}`;

        results = await sql.begin(async (tx) => {
          // Create temp table with VALUES using parameterized query
          const placeholders = idHashes.map((_, i) => `($${i + 1})`).join(", ");
          await tx.unsafe(
            `CREATE TEMP TABLE ${temporaryTableName} AS SELECT * FROM (VALUES ${placeholders}) AS t(id)`,
            idHashes
          );

          let result: Array<{ field_hashed_value: string }>;
          if (olderThanOneMonth) {
            result = await tx`
              SELECT field_hashed_value FROM feed_article_field_partitioned
              INNER JOIN ${sql.unsafe(temporaryTableName)} t ON (field_hashed_value = t.id)
              WHERE created_at <= ${oneMonthAgo}
                AND feed_id = ${feedId}
                AND field_name = 'id'
            `;
          } else {
            result = await tx`
              SELECT field_hashed_value FROM feed_article_field_partitioned
              INNER JOIN ${sql.unsafe(temporaryTableName)} t ON (field_hashed_value = t.id)
              WHERE created_at > ${oneMonthAgo}
                AND feed_id = ${feedId}
                AND field_name = 'id'
            `;
          }

          await tx.unsafe(`DROP TABLE ${temporaryTableName}`);

          return result;
        });
      }

      return new Set(results.map((r) => r.field_hashed_value));
    },

    async someFieldsExist(
      feedId: string,
      fields: Array<{ name: string; hashedValue: string }>
    ): Promise<boolean> {
      if (fields.length === 0) {
        return false;
      }

      // Build OR conditions dynamically
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

      const results = await sql.unsafe(
        `SELECT 1 FROM ${TABLE_NAME} WHERE feed_id = $1 AND (${conditions}) LIMIT 1`,
        params
      );

      return results.length > 0;
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
        // Store article ID hash
        pendingInserts.push({
          feedId,
          fieldName: "id",
          hashedValue: article.flattened.idHash,
          createdAt: now,
        });

        // Store comparison fields
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
      const results = await sql`
        SELECT field_name FROM feed_article_custom_comparison
        WHERE feed_id = ${feedId}
      `;

      return new Set(results.map((r: { field_name: string }) => r.field_name));
    },

    async storeComparisonNames(
      feedId: string,
      comparisonFields: string[]
    ): Promise<void> {
      for (const fieldName of comparisonFields) {
        try {
          await sql`
            INSERT INTO feed_article_custom_comparison (feed_id, field_name, created_at)
            VALUES (${feedId}, ${fieldName}, ${new Date()})
            ON CONFLICT (feed_id, field_name) DO NOTHING
          `;
        } catch {
          // Ignore unique constraint violations
        }
      }
    },

    async clear(feedId: string): Promise<void> {
      await sql`DELETE FROM feed_article_field_partitioned WHERE feed_id = ${feedId}`;
      await sql`DELETE FROM feed_article_custom_comparison WHERE feed_id = ${feedId}`;
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

        const result = await sql.unsafe(
          `INSERT INTO feed_article_field_partitioned ` +
            `(feed_id, field_name, field_hashed_value, created_at) ` +
            `VALUES ${placeholders}`,
          allValues
        );

        return { affectedRows: result.count };
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

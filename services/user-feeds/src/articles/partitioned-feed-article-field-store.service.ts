import {
  Connection,
  EntityManager,
  IDatabaseDriver,
  MikroORM,
} from "@mikro-orm/core";
import { Injectable } from "@nestjs/common";
import logger from "../shared/utils/logger";
import PartitionedFeedArticleFieldInsert from "./types/pending-feed-article-field-insert.types";

@Injectable()
export class PartitionedFeedArticleFieldStoreService {
  constructor(private readonly orm: MikroORM) {}

  async persist(
    inserts: PartitionedFeedArticleFieldInsert[],
    em: EntityManager<IDatabaseDriver<Connection>>
  ) {
    const connection = em.getConnection();

    try {
      await Promise.all(
        inserts.map(async (insert) => {
          await connection.execute(
            `INSERT INTO feed_article_field_partitioned ` +
              `(feed_id, field_name, field_hashed_value, created_at) VALUES (?, ?, ?, ?)`,
            [
              insert.feedId,
              insert.fieldName,
              insert.fieldHashedValue,
              insert.createdAt,
            ]
          );
        })
      );
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any).code === "23505") {
        logger.warn("Duplicate key error while inserting feed article field", {
          error: (err as Error).stack,
        });
      } else {
        logger.error("Error while inserting partitioned feed article field", {
          error: (err as Error).stack,
        });
      }
    }
  }

  async hasArticlesStoredForFeed(feedId: string) {
    const connection = this.orm.em.getConnection();

    const [result] = await connection.execute(
      `SELECT 1 AS result FROM feed_article_field_partitioned WHERE feed_id = ? LIMIT 1`,
      [feedId]
    );

    return !!result;
  }

  async findIdFieldsForFeed(
    feedId: string,
    ids: string[]
  ): Promise<
    Array<{
      field_hashed_value: string;
    }>
  > {
    const connection = this.orm.em.getConnection();

    const results = await connection.execute(
      `SELECT field_hashed_value` +
        ` FROM feed_article_field_partitioned` +
        ` WHERE feed_id = ? AND field_name = 'id' AND field_hashed_value IN (${ids
          .map(() => "?")
          .join(", ")})`,
      [feedId, ...ids]
    );

    return results;
  }

  async someFieldsExist(
    feedId: string,
    fields: Array<{ name: string; value: string }>
  ) {
    const connection = this.orm.em.getConnection();

    if (fields.length === 0) {
      throw new Error(
        `No fields provided while checking if some fields exist for feed ${feedId}`
      );
    }

    const results = await connection.execute(
      `SELECT 1` +
        ` FROM feed_article_field_partitioned` +
        ` WHERE feed_id = ? AND (${fields
          .map(() => `field_name = ? AND field_hashed_value = ?`)
          .join(" OR ")}) LIMIT 1`,
      [feedId, ...fields.flatMap((field) => [field.name, field.value])]
    );

    return !!results.length;
  }

  async deleteAllForFeed(feedId: string) {
    const connection = this.orm.em.getConnection();

    await connection.execute(
      `DELETE FROM feed_article_field_partitioned WHERE feed_id = ?`,
      [feedId]
    );
  }
}

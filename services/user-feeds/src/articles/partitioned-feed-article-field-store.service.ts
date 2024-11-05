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
  connection: Connection;
  TABLE_NAME = "feed_article_field_partitioned";

  constructor(private readonly orm: MikroORM) {
    this.connection = this.orm.em.getConnection();
  }

  async persist(
    inserts: PartitionedFeedArticleFieldInsert[],
    em: EntityManager<IDatabaseDriver<Connection>>
  ) {
    if (inserts.length === 0) {
      return;
    }

    const connection = em.getConnection();

    const allValues = inserts.flatMap((insert) => [
      insert.feedId,
      insert.fieldName,
      insert.fieldHashedValue,
      insert.createdAt,
    ]);

    const values = inserts.map(() => "(?, ?, ?, ?)").join(", ");

    const sql =
      `INSERT INTO ${this.TABLE_NAME} ` +
      `(feed_id, field_name, field_hashed_value, created_at) VALUES ${values}`;

    try {
      await connection.execute(sql, allValues);
    } catch (err) {
      logger.error("Error inserting into feed_article_field_partitioned", {
        sql,
        allValues,
        stack: (err as Error).stack,
      });
      throw err;
    }
  }

  async hasArticlesStoredForFeed(feedId: string) {
    const [result] = await this.connection.execute(
      `SELECT 1 AS result FROM ${this.TABLE_NAME} WHERE feed_id = ? LIMIT 1`,
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
    const results = await this.connection.execute(
      `SELECT field_hashed_value` +
        ` FROM ${this.TABLE_NAME}` +
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
    const results = await this.connection.execute(
      `SELECT 1` +
        ` FROM ${this.TABLE_NAME}` +
        ` WHERE feed_id = ? AND (${fields
          .map(() => `field_name = ? AND field_hashed_value = ?`)
          .join(" OR ")}) LIMIT 1`,
      [feedId, ...fields.flatMap((field) => [field.name, field.value])]
    );

    return !!results.length;
  }

  async deleteAllForFeed(feedId: string) {
    await this.connection.execute(
      `DELETE FROM ${this.TABLE_NAME} WHERE feed_id = ?`,
      [feedId]
    );
  }
}

import {
  Connection,
  EntityManager,
  IDatabaseDriver,
  MikroORM,
} from "@mikro-orm/core";
import { Injectable } from "@nestjs/common";
import PartitionedFeedArticleFieldInsert from "./types/pending-feed-article-field-insert.types";

@Injectable()
export class PartitionedFeedArticleFieldStoreService {
  connection: Connection;
  constructor(private readonly orm: MikroORM) {
    this.connection = this.orm.em.getConnection();
  }

  async persist(
    inserts: PartitionedFeedArticleFieldInsert[],
    em: EntityManager<IDatabaseDriver<Connection>>
  ) {
    const connection = em.getConnection();

    const allValues = inserts.flatMap((insert) => [
      insert.feedId,
      insert.fieldName,
      insert.fieldHashedValue,
      insert.createdAt,
    ]);

    const values = inserts.map(() => "(?, ?, ?, ?)").join(", ");

    await connection.execute(
      `INSERT INTO feed_article_field_partitioned ` +
        `(feed_id, field_name, field_hashed_value, created_at) VALUES ${values}`,
      allValues
    );
  }

  async hasArticlesStoredForFeed(feedId: string) {
    const [result] = await this.connection.execute(
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
    const results = await this.connection.execute(
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
    const results = await this.connection.execute(
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
    await this.connection.execute(
      `DELETE FROM feed_article_field_partitioned WHERE feed_id = ?`,
      [feedId]
    );
  }
}

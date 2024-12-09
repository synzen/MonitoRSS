import {
  Connection,
  EntityManager,
  IDatabaseDriver,
  MikroORM,
} from "@mikro-orm/core";
import { Injectable } from "@nestjs/common";
import dayjs from "dayjs";
import logger from "../shared/utils/logger";
import PartitionedFeedArticleFieldInsert from "./types/pending-feed-article-field-insert.types";
import { AsyncLocalStorage } from "node:async_hooks";

interface AsyncStore {
  toInsert: PartitionedFeedArticleFieldInsert[];
}

const asyncLocalStorage = new AsyncLocalStorage<AsyncStore>();

@Injectable()
export class PartitionedFeedArticleFieldStoreService {
  connection: Connection;
  TABLE_NAME = "feed_article_field_partitioned";

  constructor(private readonly orm: MikroORM) {
    this.connection = this.orm.em.getConnection();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async startContext<T>(cb: () => Promise<T>) {
    return asyncLocalStorage.run(
      {
        toInsert: [],
      },
      cb
    );
  }

  async markForPersistence(inserts: PartitionedFeedArticleFieldInsert[]) {
    if (inserts.length === 0) {
      return;
    }

    const store = asyncLocalStorage.getStore();

    if (!store) {
      throw new Error(
        "No context was started for PartitionedFeedArticleFieldStoreService"
      );
    }

    store.toInsert.push(...inserts);
  }

  async flush(em: EntityManager<IDatabaseDriver<Connection>>) {
    const store = asyncLocalStorage.getStore();

    if (!store) {
      throw new Error(
        "No context was started for PartitionedFeedArticleFieldStoreService"
      );
    }

    const { toInsert: inserts } = store;

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
    } finally {
      store.toInsert = [];
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
    ids: string[],
    olderThanOneMonth: boolean
  ): Promise<
    Array<{
      field_hashed_value: string;
    }>
  > {
    const oneMonthAgo = dayjs().subtract(1, "month").toISOString();

    if (ids.length < 70) {
      return this.connection.execute(
        `SELECT field_hashed_value` +
          ` FROM ${this.TABLE_NAME}` +
          ` WHERE ${
            olderThanOneMonth ? `created_at <= ?` : `created_at > ?`
          } AND feed_id = ? AND field_name = 'id' AND field_hashed_value IN (${ids
            .map(() => "?")
            .join(", ")})`,
        [oneMonthAgo, feedId, ...ids]
      );
    } else {
      const temporaryTableName = `current_article_ids_${feedId}`;
      const sql =
        `CREATE TEMP TABLE ${temporaryTableName} AS` +
        ` SELECT * FROM (VALUES ${ids.map(() => "(?)").join(", ")}) AS t(id)` +
        ` SELECT field_hashed_value` +
        ` FROM ${this.TABLE_NAME}` +
        ` INNER JOIN ${temporaryTableName} t ON (field_hashed_value = t.id)` +
        ` WHERE ${
          olderThanOneMonth ? `created_at <= ?` : `created_at > ?`
        } AND feed_id = ? AND field_name = 'id'`;

      const result = await this.connection.execute(sql, [
        ...ids,
        oneMonthAgo,
        feedId,
      ]);

      await this.connection.execute(`DROP TABLE ${temporaryTableName}`);

      return result;
    }
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

import { Injectable } from "@nestjs/common";
import {
  ArticleDeliveryErrorCode,
  ArticleDeliveryState,
  ArticleDeliveryStatus,
} from "../shared";
import { DeliveryRecord } from "./entities";
import { MikroORM } from "@mikro-orm/core";
import { GetUserFeedDeliveryRecordsOutputDto } from "../feeds/dto";
import { DeliveryLogStatus } from "../feeds/constants/delivery-log-status.constants";
import PartitionedDeliveryRecordInsert from "./types/partitioned-delivery-record-insert.type";
import { AsyncLocalStorage } from "node:async_hooks";

const { Failed, Rejected, Sent, PendingDelivery, FilteredOut } =
  ArticleDeliveryStatus;

interface AsyncStore {
  toInsert: PartitionedDeliveryRecordInsert[];
}

const asyncLocalStorage = new AsyncLocalStorage<AsyncStore>();

@Injectable()
export class DeliveryRecordService {
  constructor(
    private readonly orm: MikroORM // Required for @UseRequestContext()
  ) {}

  async startContext<T>(cb: () => Promise<T>) {
    return asyncLocalStorage.run(
      {
        toInsert: [],
      },
      cb
    );
  }

  async store(
    feedId: string,
    articleStates: ArticleDeliveryState[],
    flush = true
  ) {
    const records = articleStates.map((articleState) => {
      const { status: articleStatus } = articleState;

      let record: DeliveryRecord;
      const recordId = articleState.id;

      const useArticleData = articleState.article?.flattened.title
        ? {
            title: articleState.article?.flattened.title,
          }
        : null;

      if (articleStatus === Sent) {
        record = new DeliveryRecord({
          id: recordId,
          feed_id: feedId,
          status: articleStatus,
          medium_id: articleState.mediumId,
          content_type: articleState.contentType,
          article_id_hash: articleState.articleIdHash,
          parent: articleState.parent
            ? ({ id: articleState.parent } as never)
            : null,
          article_data: useArticleData,
        });
      } else if (articleStatus === Failed || articleStatus === Rejected) {
        record = new DeliveryRecord({
          id: recordId,
          feed_id: feedId,
          status: articleStatus,
          error_code: articleState.errorCode,
          internal_message: articleState.internalMessage,
          medium_id: articleState.mediumId,
          article_id_hash: articleState.articleIdHash,
          external_detail:
            articleStatus === Rejected ? articleState.externalDetail : null,
          article_data: useArticleData,
        });
      } else if (articleStatus === PendingDelivery) {
        record = new DeliveryRecord({
          id: recordId,
          feed_id: feedId,
          status: articleStatus,
          medium_id: articleState.mediumId,
          parent: articleState.parent
            ? ({
                id: articleState.parent,
              } as never)
            : null,
          content_type: articleState.contentType,
          article_id_hash: articleState.articleIdHash,
          article_data: useArticleData,
        });
      } else if (articleStatus === FilteredOut) {
        record = new DeliveryRecord({
          id: recordId,
          feed_id: feedId,
          status: articleStatus,
          medium_id: articleState.mediumId,
          article_id_hash: articleState.articleIdHash,
          external_detail: articleState.externalDetail,
          article_data: useArticleData,
        });
      } else {
        record = new DeliveryRecord({
          id: recordId,
          feed_id: feedId,
          status: articleStatus,
          medium_id: articleState.mediumId,
          article_id_hash: articleState.articleIdHash,
          article_data: useArticleData,
        });
      }

      return record;
    });

    const partitionedInserts: PartitionedDeliveryRecordInsert[] = records.map(
      (record) => {
        const { id, feed_id, medium_id, created_at, status, content_type } =
          record;

        return {
          id,
          feedId: feed_id,
          mediumId: medium_id,
          createdAt: created_at,
          status,
          contentType: content_type ?? null,
          parentId: record.parent?.id ?? null,
          internalMessage: record.internal_message ?? null,
          errorCode: record.error_code ?? null,
          externalDetail: record.external_detail ?? null,
          articleId: record.article_id ?? null,
          articleIdHash: record.article_id_hash ?? null,
          articleData: record.article_data ?? null,
        };
      }
    );

    const store = asyncLocalStorage.getStore();

    if (!store) {
      throw new Error("No context was started for DeliveryRecordService");
    }

    store.toInsert.push(...partitionedInserts);

    if (flush) {
      const { affectedRows } = await this.flushPendingInserts();

      return {
        inserted: affectedRows,
      };
    }
  }

  async updateDeliveryStatus(
    id: string,
    details: {
      status: ArticleDeliveryStatus;
      errorCode?: string;
      internalMessage?: string;
      externalDetail?: string;
      articleId?: string;
    },
    returnRecord?: boolean
  ): Promise<{
    feed_id: string;
    medium_id: string;
    status: ArticleDeliveryStatus;
    error_code?: string;
    internal_message?: string;
  }> {
    const { status, errorCode, internalMessage, externalDetail } = details;

    const [res] = await this.orm.em.getConnection().execute(
      `
      UPDATE delivery_record_partitioned
      SET status = ?, error_code = ?, internal_message = ?, external_detail = ?
      WHERE id = ?
      ${
        returnRecord
          ? "RETURNING status, error_code, feed_id, medium_id, internal_message"
          : "RETURNING id"
      }
    `,
      [status, errorCode, internalMessage, externalDetail, id]
    );

    if (!res) {
      throw new Error(
        `Failed to update status of delivery record for ${id}: Record not found`
      );
    }

    return res;
  }

  async countDeliveriesInPastTimeframe(
    { mediumId, feedId }: { mediumId?: string; feedId?: string },
    secondsInPast: number
  ) {
    // Use partitioned table for faster count
    const query = await this.orm.em.getConnection().execute(
      `
      SELECT COUNT(*) FROM delivery_record_partitioned
      WHERE created_at >= NOW() - INTERVAL '${secondsInPast} seconds'
      AND status IN (?)
      ${mediumId ? "AND medium_id = ?" : ""}
      ${feedId ? "AND feed_id = ?" : ""}
      `,
      [Sent, ...(mediumId ? [mediumId] : []), ...(feedId ? [feedId] : [])]
    );

    return Number(query[0].count);
  }

  async getDeliveryLogs({
    limit,
    feedId,
    skip,
  }: {
    limit: number;
    skip: number;
    feedId: string;
  }): Promise<GetUserFeedDeliveryRecordsOutputDto["result"]["logs"]> {
    const records: DeliveryRecord[] = await this.orm.em.getConnection().execute(
      `
      SELECT id, status, error_code, medium_id,
        content_type, external_detail, article_id_hash, created_at, article_data
      FROM delivery_record_partitioned
      WHERE feed_id = ?
      AND parent_id IS NULL
      ORDER BY created_at DESC
      LIMIT ?
      OFFSET ?
    `,
      [feedId, limit, skip]
    );

    let childRecords: DeliveryRecord[];

    if (records.length) {
      const found = await this.orm.em.getConnection().execute(
        `
      SELECT id, status, error_code, medium_id,
        content_type, external_detail, article_id_hash, created_at, parent_id, article_data
      FROM delivery_record_partitioned
      WHERE feed_id = ?
      AND parent_id IN (${records.map(() => "?").join(", ")})
    `,
        [feedId, ...records.map((record) => record.id)]
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      childRecords = found.map((record: any) => {
        return {
          ...record,
          parent: {
            id: record.parent_id,
          },
        };
      });
    }

    return records.map((record) => {
      const children = childRecords.filter(
        (childRecord) => childRecord.parent?.id === record.id
      );

      let status: DeliveryLogStatus;
      const details: { message?: string; data?: Record<string, unknown> } = {
        message: undefined,
        data: undefined,
      };

      if (record.status === ArticleDeliveryStatus.Sent) {
        if (children.some((c) => c.status !== ArticleDeliveryStatus.Sent)) {
          status = DeliveryLogStatus.PARTIALLY_DELIVERED;
        } else {
          status = DeliveryLogStatus.DELIVERED;
        }
      } else if (record.status === ArticleDeliveryStatus.Rejected) {
        status = DeliveryLogStatus.REJECTED;

        try {
          if (record.external_detail) {
            details.data = JSON.parse(record.external_detail)?.data;
          }
        } catch (err) {}

        if (
          record.error_code === ArticleDeliveryErrorCode.NoChannelOrWebhook ||
          record.error_code === ArticleDeliveryErrorCode.ThirdPartyNotFound
        ) {
          details.message = "Connection destination does not exist";
        } else if (
          record.error_code === ArticleDeliveryErrorCode.ThirdPartyBadRequest
        ) {
          details.message = "Invalid message format";

          try {
            if (record.external_detail) {
              details.data = JSON.parse(record.external_detail);
            }
          } catch (err) {}
        } else if (
          record.error_code === ArticleDeliveryErrorCode.ThirdPartyForbidden
        ) {
          details.message =
            "Missing permissions to send to connection destination";
        } else if (
          record.error_code === ArticleDeliveryErrorCode.ThirdPartyInternal
        ) {
          details.message =
            "Connection target service was experiencing internal errors";
        } else if (record.error_code === ArticleDeliveryErrorCode.Internal) {
          details.message = "Internal error";
        } else if (
          record.error_code === ArticleDeliveryErrorCode.ArticleProcessingError
        ) {
          details.message =
            "Failed to parse article content with current configuration";

          try {
            if (record.external_detail) {
              details.data = JSON.parse(record.external_detail)?.message;
            }
          } catch (err) {}
        }
      } else if (record.status === ArticleDeliveryStatus.Failed) {
        status = DeliveryLogStatus.FAILED;
      } else if (record.status === ArticleDeliveryStatus.PendingDelivery) {
        status = DeliveryLogStatus.PENDING_DELIVERY;
      } else if (record.status === ArticleDeliveryStatus.RateLimited) {
        status = DeliveryLogStatus.ARTICLE_RATE_LIMITED;
      } else if (
        record.status === ArticleDeliveryStatus.MediumRateLimitedByUser
      ) {
        status = DeliveryLogStatus.MEDIUM_RATE_LIMITED;
      } else if (record.status === ArticleDeliveryStatus.FilteredOut) {
        status = DeliveryLogStatus.FILTERED_OUT;

        try {
          if (record.external_detail) {
            details.data = JSON.parse(record.external_detail);
          }
        } catch (err) {}
      } else {
        throw new Error(
          `Unhandled article delivery status: ${record.status} for record: ${record.id}`
        );
      }

      return {
        id: record.id,
        mediumId: record.medium_id,
        createdAt: new Date(record.created_at).toISOString(),
        details,
        articleIdHash: record.article_id_hash,
        status,
        articleData: record.article_data,
      };
    });
  }

  async flushPendingInserts() {
    const store = asyncLocalStorage.getStore();

    if (!store) {
      throw new Error("No context was started for DeliveryRecordService");
    }

    const { toInsert: inserts } = store;

    if (inserts.length === 0) {
      return {
        affectedRows: 0,
      };
    }

    const em = this.orm.em.fork().getConnection();
    const transaction = await em.begin();

    try {
      const res = await Promise.all(
        inserts.map((record) => {
          return em.execute(
            `INSERT INTO delivery_record_partitioned (
              id,
              feed_id,
              medium_id,
              created_at,
              status,
              content_type,
              parent_id,
              internal_message,
              error_code,
              external_detail,
              article_id,
              article_id_hash,
              article_data
            ) VALUES (
             ?,?,?,?,?,?,?,?,?,?,?,?,?
            )`,
            [
              record.id,
              record.feedId,
              record.mediumId,
              record.createdAt,
              record.status,
              record.contentType,
              record.parentId,
              record.internalMessage,
              record.errorCode,
              record.externalDetail,
              record.articleId,
              record.articleIdHash,
              record.articleData,
            ],
            transaction
          );
        })
      );

      await em.commit(transaction);

      return {
        affectedRows: res.reduce((accumulator, cv) => {
          return accumulator + cv.affectedRows;
        }, 0) as number,
      };
    } catch (err) {
      await em.rollback(transaction);
      throw err;
    } finally {
      store.toInsert = [];
    }
  }
}

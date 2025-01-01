import { InjectRepository } from "@mikro-orm/nestjs";
import { EntityRepository } from "@mikro-orm/postgresql";
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
import logger from "../shared/utils/logger";

const { Failed, Rejected, Sent, PendingDelivery, FilteredOut } =
  ArticleDeliveryStatus;

@Injectable()
export class DeliveryRecordService {
  pendingInserts: PartitionedDeliveryRecordInsert[] = [];

  constructor(
    @InjectRepository(DeliveryRecord)
    private readonly recordRepo: EntityRepository<DeliveryRecord>,
    private readonly orm: MikroORM // Required for @UseRequestContext()
  ) {}

  async store(
    feedId: string,
    articleStates: ArticleDeliveryState[],
    flush = true
  ) {
    const records = articleStates.map((articleState) => {
      const { status: articleStatus } = articleState;

      let record: DeliveryRecord;
      const recordId = articleState.id;

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
        });
      } else if (articleStatus === FilteredOut) {
        record = new DeliveryRecord({
          id: recordId,
          feed_id: feedId,
          status: articleStatus,
          medium_id: articleState.mediumId,
          article_id_hash: articleState.articleIdHash,
          external_detail: articleState.externalDetail,
        });
      } else {
        record = new DeliveryRecord({
          id: recordId,
          feed_id: feedId,
          status: articleStatus,
          medium_id: articleState.mediumId,
          article_id_hash: articleState.articleIdHash,
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
        };
      }
    );

    if (flush) {
      await this.orm.em.persistAndFlush(records);
      await this.flushPendingInserts();
    } else {
      this.pendingInserts.push(...partitionedInserts);
      this.orm.em.persist(records);
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
    }
  ) {
    const { status, errorCode, internalMessage, externalDetail } = details;

    const record = await this.recordRepo.findOneOrFail(id);

    record.status = status;
    record.error_code = errorCode;
    record.internal_message = internalMessage;
    record.external_detail = externalDetail;

    await this.recordRepo.persistAndFlush(record);

    try {
      await this.orm.em.getConnection().execute(
        `
      UPDATE delivery_record_partitioned
      SET status = ?, error_code = ?, internal_message = ?, external_detail = ?
      WHERE id = ?
    `,
        [status, errorCode, internalMessage, externalDetail, id]
      );
    } catch (err) {
      logger.error("Error while updating partitioned delivery record", {
        error: (err as Error).stack,
      });
    }

    return record;
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
      AND status IN (?, ?)
      ${mediumId ? "AND medium_id = ?" : ""}
      ${feedId ? "AND feed_id = ?" : ""}
      `,
      [
        Sent,
        Rejected,
        ...(mediumId ? [mediumId] : []),
        ...(feedId ? [feedId] : []),
      ]
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
        content_type, external_detail, article_id_hash, created_at
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
        content_type, external_detail, article_id_hash, created_at, parent_id
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
        createdAt: record.created_at.toISOString(),
        details,
        articleIdHash: record.article_id_hash,
        status,
      };
    });
  }

  async flushPendingInserts() {
    if (this.pendingInserts.length === 0) {
      return;
    }

    const em = this.orm.em.fork().getConnection();
    const transaction = await em.begin();

    try {
      await Promise.all(
        this.pendingInserts.map((record) => {
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
              article_id_hash
            ) VALUES (
             ?,?,?,?,?,?,?,?,?,?,?,?
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
            ],
            transaction
          );
        })
      );

      await em.commit(transaction);
    } catch (err) {
      await em.rollback(transaction);

      logger.error("Error while inserting partitioned delivery records", {
        error: (err as Error).stack,
      });
    } finally {
      this.pendingInserts.length = 0;
    }
  }
}

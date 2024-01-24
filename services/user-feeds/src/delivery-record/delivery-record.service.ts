import { InjectRepository } from "@mikro-orm/nestjs";
import { EntityRepository } from "@mikro-orm/postgresql";
import { Injectable } from "@nestjs/common";
import {
  ArticleDeliveryErrorCode,
  ArticleDeliveryState,
  ArticleDeliveryStatus,
} from "../shared";
import { DeliveryRecord } from "./entities";
import dayjs from "dayjs";
import { MikroORM } from "@mikro-orm/core";
import { GetUserFeedDeliveryRecordsOutputDto } from "../feeds/dto";
import { DeliveryLogStatus } from "../feeds/constants/delivery-log-status.constants";

const { Failed, Rejected, Sent, PendingDelivery, FilteredOut } =
  ArticleDeliveryStatus;

@Injectable()
export class DeliveryRecordService {
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

      if (articleStatus === Sent) {
        record = new DeliveryRecord({
          id: articleState.id,
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
          id: articleState.id,
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
          id: articleState.id,
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
          id: articleState.id,
          feed_id: feedId,
          status: articleStatus,
          medium_id: articleState.mediumId,
          article_id_hash: articleState.articleIdHash,
          external_detail: articleState.externalDetail,
        });
      } else {
        record = new DeliveryRecord({
          id: articleState.id,
          feed_id: feedId,
          status: articleStatus,
          medium_id: articleState.mediumId,
          article_id_hash: articleState.articleIdHash,
        });
      }

      return record;
    });

    if (flush) {
      await this.orm.em.persistAndFlush(records);
    } else {
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

    return record;
  }

  async countDeliveriesInPastTimeframe(
    { mediumId, feedId }: { mediumId?: string; feedId?: string },
    secondsInPast: number
  ) {
    // Convert initial counts to the same query below
    const subquery = this.recordRepo
      .createQueryBuilder()
      .count()
      .where({
        ...(mediumId
          ? {
              medium_id: mediumId,
            }
          : {}),
        ...(feedId
          ? {
              feed_id: feedId,
            }
          : {}),
      })
      .andWhere({
        status: {
          $in: [Sent, Rejected],
        },
      })
      .andWhere({
        created_at: {
          $gte: dayjs().subtract(secondsInPast, "second").toDate(),
        },
      })
      .groupBy("article_id_hash");

    const query = await this.recordRepo
      .createQueryBuilder()
      .count()
      .from(subquery, "subquery")
      .execute("get");

    return Number(query.count);
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
    const selectFields: Array<keyof DeliveryRecord> = [
      "id",
      "status",
      "error_code",
      "medium_id",
      "content_type",
      "external_detail",
      "article_id_hash",
      "created_at",
    ];
    const records = await this.recordRepo.find(
      {
        feed_id: feedId,
        parent: null,
      },
      {
        limit,
        orderBy: {
          created_at: "DESC",
        },
        fields: selectFields,
        offset: skip,
      }
    );

    const childRecords = await this.recordRepo.find(
      {
        feed_id: feedId,
        parent: {
          $in: records.map((record) => record.id),
        },
      },
      {
        fields: selectFields,
      }
    );

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
}

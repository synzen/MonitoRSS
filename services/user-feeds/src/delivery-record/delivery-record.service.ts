import { InjectRepository } from "@mikro-orm/nestjs";
import { EntityRepository } from "@mikro-orm/postgresql";
import { Injectable } from "@nestjs/common";
import { ArticleDeliveryState, ArticleDeliveryStatus } from "../shared";
import { DeliveryRecord } from "./entities";
import dayjs from "dayjs";
import { MikroORM } from "@mikro-orm/core";

const { Failed, Rejected, Sent, PendingDelivery } = ArticleDeliveryStatus;

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
        });
      } else {
        record = new DeliveryRecord({
          id: articleState.id,
          feed_id: feedId,
          status: articleStatus,
          medium_id: articleState.mediumId,
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
    const { status, errorCode, internalMessage, externalDetail, articleId } =
      details;

    const record = await this.recordRepo.findOneOrFail(id);

    record.status = status;
    record.error_code = errorCode;
    record.internal_message = internalMessage;
    record.external_detail = externalDetail;
    record.article_id = articleId;

    await this.recordRepo.persistAndFlush(record);

    return record;
  }

  countDeliveriesInPastTimeframe(
    { feedId }: { feedId: string },
    secondsInPast: number
  ) {
    return this.recordRepo.count({
      feed_id: feedId,
      status: {
        $in: [Sent, Rejected],
      },
      created_at: {
        $gte: dayjs().subtract(secondsInPast, "second").toDate(),
      },
    });
  }
}

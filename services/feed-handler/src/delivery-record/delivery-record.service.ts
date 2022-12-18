import { InjectRepository } from "@mikro-orm/nestjs";
import { EntityRepository } from "@mikro-orm/postgresql";
import { Injectable } from "@nestjs/common";
import { ArticleDeliveryState, ArticleDeliveryStatus } from "../shared";
import { DeliveryRecord } from "./entities";
import dayjs from "dayjs";

const { Failed, Rejected, Sent } = ArticleDeliveryStatus;

@Injectable()
export class DeliveryRecordService {
  constructor(
    @InjectRepository(DeliveryRecord)
    private readonly recordRepo: EntityRepository<DeliveryRecord>
  ) {}

  async store(feedId: string, articleStates: ArticleDeliveryState[]) {
    const records = articleStates.map((articleState) => {
      const { status: articleStatus } = articleState;

      let record: DeliveryRecord;

      if (articleStatus === Sent) {
        record = new DeliveryRecord({
          id: articleState.id,
          feed_id: feedId,
          status: articleStatus,
          medium_id: articleState.mediumId,
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

    await this.recordRepo.persistAndFlush(records);
  }

  async updateDeliveryStatus(
    id: string,
    details: {
      status: ArticleDeliveryStatus;
      errorCode?: string;
      internalMessage?: string;
    }
  ) {
    const { status, errorCode, internalMessage } = details;

    const record = await this.recordRepo.findOneOrFail(id);

    record.status = status;
    record.error_code = errorCode;
    record.internal_message = internalMessage;

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

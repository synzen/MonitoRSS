import { InjectRepository } from "@mikro-orm/nestjs";
import { EntityRepository } from "@mikro-orm/postgresql";
import { Injectable } from "@nestjs/common";
import { ArticleDeliveryState, ArticleDeliveryStatus } from "../shared";
import { DeliveryRecord } from "./entities";

const { Failed, Rejected, Sent } = ArticleDeliveryStatus;

@Injectable()
export class DeliveryRecordService {
  constructor(
    @InjectRepository(DeliveryRecord)
    private readonly articleFieldRepo: EntityRepository<DeliveryRecord>
  ) {}

  async store(feedId: string, articleState: ArticleDeliveryState) {
    let record: DeliveryRecord;

    const { status: articleStatus } = articleState;

    if (articleStatus === Sent) {
      record = new DeliveryRecord({
        feed_id: feedId,
        status: articleStatus,
      });
    } else if (articleStatus === Failed || articleStatus === Rejected) {
      record = new DeliveryRecord({
        feed_id: feedId,
        status: articleStatus,
        error_code: articleState.errorCode,
        internal_message: articleState.internalMessage,
      });
    } else {
      record = new DeliveryRecord({
        feed_id: feedId,
        status: articleStatus,
      });
    }

    await this.articleFieldRepo.persistAndFlush(record);
  }
}

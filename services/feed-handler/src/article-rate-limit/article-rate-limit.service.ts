import { InjectRepository } from "@mikro-orm/nestjs";
import { EntityRepository } from "@mikro-orm/postgresql";
import { Injectable } from "@nestjs/common";
import { DeliveryRecordService } from "../delivery-record/delivery-record.service";
import { FeedArticleDeliveryLimit } from "./entities";

@Injectable()
export class ArticleRateLimitService {
  constructor(
    private readonly deliveryRecordService: DeliveryRecordService,
    @InjectRepository(FeedArticleDeliveryLimit)
    private readonly deliveryLimitRepo: EntityRepository<FeedArticleDeliveryLimit>
  ) {}

  async getArticlesInLastTimeframe(feedId: string, secondsInPast: number) {
    return this.deliveryRecordService.countDeliveriesInPastTimeframe(
      { feedId },
      secondsInPast
    );
  }

  async addOrUpdateFeedLimit(
    feedId: string,
    { timeWindowSec, limit }: { timeWindowSec: number; limit: number }
  ) {
    const found = await this.deliveryLimitRepo.findOne({
      feed_id: feedId,
      time_window_seconds: timeWindowSec,
    });

    if (found) {
      if (found.limit !== limit) {
        found.limit = limit;
        await this.deliveryLimitRepo.flush();
      }
    } else {
      const newLimit = new FeedArticleDeliveryLimit({
        feed_id: feedId,
        time_window_seconds: timeWindowSec,
        limit,
      });

      await this.deliveryLimitRepo.persistAndFlush(newLimit);
    }
  }
}

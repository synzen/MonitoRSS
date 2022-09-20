import { Injectable } from "@nestjs/common";
import { DeliveryRecordService } from "../delivery-record/delivery-record.service";

@Injectable()
export class ArticleRateLimitService {
  constructor(private readonly deliveryRecordService: DeliveryRecordService) {}

  async getArticlesInLastTimeframe(feedId: string, secondsInPast: number) {
    return this.deliveryRecordService.countDeliveriesInPastTimeframe(
      { feedId },
      secondsInPast
    );
  }
}

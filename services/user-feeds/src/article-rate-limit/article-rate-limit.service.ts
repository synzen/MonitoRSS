import { MikroORM } from "@mikro-orm/core";
import { Injectable } from "@nestjs/common";
import { DeliveryRecordService } from "../delivery-record/delivery-record.service";
import { MediumRateLimit } from "../shared/types/medium-rate-limits.type";

@Injectable()
export class ArticleRateLimitService {
  constructor(
    private readonly deliveryRecordService: DeliveryRecordService,
    private readonly orm: MikroORM
  ) {}

  async getUnderLimitCheckFromInputLimits(
    { feedId, mediumId }: { feedId?: string; mediumId?: string },
    inputLimits: MediumRateLimit[]
  ) {
    if (inputLimits.length === 0) {
      return {
        underLimit: true,
        remaining: Number.MAX_SAFE_INTEGER,
      };
    }

    const limits = await this.getTransientFeedLimitInformation(
      { feedId, mediumId },
      inputLimits
    );

    return {
      underLimit: limits.every(({ remaining }) => remaining > 0),
      remaining: Math.min(...limits.map(({ remaining }) => remaining)),
    };
  }

  async getTransientFeedLimitInformation(
    { mediumId, feedId }: { mediumId?: string; feedId?: string },
    limits: Array<MediumRateLimit>
  ) {
    return await Promise.all(
      limits.map(async ({ limit, timeWindowSeconds: timeWindowSec }) => {
        const articlesInTimeframe =
          await this.deliveryRecordService.countDeliveriesInPastTimeframe(
            { mediumId, feedId },
            timeWindowSec
          );

        return {
          progress: articlesInTimeframe,
          max: limit,
          remaining: Math.max(limit - articlesInTimeframe, 0),
          windowSeconds: timeWindowSec,
        };
      })
    );
  }
}

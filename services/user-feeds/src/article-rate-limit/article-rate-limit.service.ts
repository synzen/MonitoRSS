import { MikroORM } from "@mikro-orm/core";
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
    private readonly deliveryLimitRepo: EntityRepository<FeedArticleDeliveryLimit>,
    private readonly orm: MikroORM
  ) {}

  async getUnderLimitCheck(feedId: string) {
    const limits = await this.getFeedLimitInformation(feedId);

    return {
      underLimit: limits.every(({ remaining }) => remaining > 0),
      remaining: Math.min(...limits.map(({ remaining }) => remaining)),
    };
  }

  async getFeedLimitInformation(feedId: string) {
    const limits = await this.deliveryLimitRepo.find(
      { feed_id: feedId },
      {
        orderBy: {
          time_window_seconds: "asc",
        },
      }
    );

    return await Promise.all(
      limits.map(
        async ({
          limit,
          time_window_seconds: timeWindowSec,
          feed_id: feedId,
        }) => {
          const articlesInTimeframe =
            await this.deliveryRecordService.countDeliveriesInPastTimeframe(
              { feedId },
              timeWindowSec
            );

          return {
            progress: articlesInTimeframe,
            max: limit,
            remaining: Math.max(limit - articlesInTimeframe, 0),
            windowSeconds: timeWindowSec,
          };
        }
      )
    );
  }

  async addOrUpdateFeedLimit(
    feedId: string,
    { timeWindowSec, limit }: { timeWindowSec: number; limit: number },
    flush = true
  ) {
    const countCheck = await this.deliveryLimitRepo.findOne(
      {
        feed_id: feedId,
        time_window_seconds: timeWindowSec,
        limit,
      },
      {
        fields: ["id"],
      }
    );

    if (countCheck) {
      return;
    }

    const found = await this.deliveryLimitRepo.findOne({
      feed_id: feedId,
      time_window_seconds: timeWindowSec,
    });

    if (found) {
      found.limit = limit;

      if (flush) {
        await this.orm.em.persistAndFlush(found);
      } else {
        this.orm.em.persist(found);
      }
    } else {
      const newLimit = new FeedArticleDeliveryLimit({
        feed_id: feedId,
        time_window_seconds: timeWindowSec,
        limit,
      });

      if (flush) {
        await this.orm.em.persistAndFlush(newLimit);
      } else {
        await this.orm.em.persist(newLimit);
      }
    }
  }
}

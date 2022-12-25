import { Injectable } from "@nestjs/common";
import { ArticleRateLimitService } from "../article-rate-limit/article-rate-limit.service";

interface InitializeFeedInputDto {
  rateLimit: {
    timeWindowSec: number;
    limit: number;
  };
}

@Injectable()
export class FeedsService {
  constructor(
    private readonly articleRateLimitsService: ArticleRateLimitService
  ) {}

  getRateLimitInformation(feedId: string) {
    return this.articleRateLimitsService.getFeedLimitInformation(feedId);
  }

  async initializeFeed(
    feedId: string,
    { rateLimit: { limit, timeWindowSec } }: InitializeFeedInputDto
  ) {
    // Used to display in UIs. May be dynamic later.
    await this.articleRateLimitsService.addOrUpdateFeedLimit(feedId, {
      timeWindowSec,
      limit,
    });
  }
}

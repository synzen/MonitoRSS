import { Injectable } from "@nestjs/common";
import { ArticleRateLimitService } from "../article-rate-limit/article-rate-limit.service";

@Injectable()
export class FeedsService {
  constructor(
    private readonly articleRateLimitsService: ArticleRateLimitService
  ) {}

  getRateLimitInformation(feedId: string) {
    return this.articleRateLimitsService.getFeedLimitInformation(feedId);
  }
}

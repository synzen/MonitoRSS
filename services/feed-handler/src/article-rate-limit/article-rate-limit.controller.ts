import { Controller, Get, Param } from "@nestjs/common";
import { ArticleRateLimitService } from "./article-rate-limit.service";

@Controller("feeds/:feedId/rate-limits")
export class ArticleRateLimitController {
  constructor(
    private readonly articleRateLimitService: ArticleRateLimitService
  ) {}

  @Get()
  async getFeedRateLimitInformation(@Param("feedId") feedId: string) {
    const limits = await this.articleRateLimitService.getFeedLimitInformation(
      feedId
    );

    return {
      results: {
        limits,
      },
    };
  }
}

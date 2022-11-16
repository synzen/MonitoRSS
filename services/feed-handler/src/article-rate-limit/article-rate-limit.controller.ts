import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiGuard } from "../shared/guards";
import { ArticleRateLimitService } from "./article-rate-limit.service";

@Controller({
  version: "1",
  path: "feeds/:feedId/rate-limits",
})
export class ArticleRateLimitController {
  constructor(
    private readonly articleRateLimitService: ArticleRateLimitService
  ) {}

  @Get()
  @UseGuards(ApiGuard)
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

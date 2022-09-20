import { Controller, Get, Param } from "@nestjs/common";
import { FeedsService } from "./feeds.service";

@Controller("feeds")
export class FeedsController {
  constructor(private readonly feedsService: FeedsService) {}

  @Get(":id/rate-limits")
  async getLimits(@Param("id") id: string): Promise<{
    results: Array<{
      progress: number;
      remaining: number;
      max: number;
    }>;
  }> {
    const results = await this.feedsService.getRateLimitInformation(id);

    return {
      results: results.map(({ progress, remaining, max }) => ({
        progress,
        remaining,
        max,
      })),
    };
  }
}

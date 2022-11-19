import { Body, Controller, Post, ValidationPipe } from "@nestjs/common";
import { CreateFeedInputDto } from "./dto";
import { FeedsService } from "./feeds.service";

@Controller("feeds")
export class FeedsController {
  constructor(private readonly feedsService: FeedsService) {}

  @Post()
  async initializeFeed(
    @Body(ValidationPipe) { feed, articleDailyLimit }: CreateFeedInputDto
  ) {
    await this.feedsService.initializeFeed(feed.id, {
      rateLimit: {
        limit: articleDailyLimit,
        timeWindowSec: 86400,
      },
    });

    return {
      articleRateLimits: await this.feedsService.getRateLimitInformation(
        feed.id
      ),
    };
  }
}

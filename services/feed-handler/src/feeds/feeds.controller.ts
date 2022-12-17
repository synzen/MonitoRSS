import {
  Body,
  Controller,
  Post,
  ValidationPipe,
  UseGuards,
} from "@nestjs/common";
import { ApiGuard } from "../shared/guards";
import { CreateFeedInputDto } from "./dto";
import { FeedsService } from "./feeds.service";

@Controller({
  version: "1",
  path: "/feeds",
})
export class FeedsController {
  constructor(private readonly feedsService: FeedsService) {}

  @Post()
  @UseGuards(ApiGuard)
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

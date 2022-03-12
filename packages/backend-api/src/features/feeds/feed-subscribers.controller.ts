import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { DiscordOAuth2Guard } from '../discord-auth/guards/DiscordOAuth2.guard';
import { UserManagesFeedServerGuard } from './guards/UserManagesFeedServer.guard';
import { GetFeedPipe } from './pipes/GetFeed.pipe';
import { DetailedFeed } from './types/detailed-feed.type';
import { GetFeedSubscribersOutputDto } from './dto/GetFeedSubscribersOutput.dto';
import { FeedSubscribersService } from './feed-subscribers.service';

@Controller('feeds')
@UseGuards(DiscordOAuth2Guard)
export class FeedSubscribersController {
  constructor(
    private readonly feedSubscribersService: FeedSubscribersService,
  ) {}

  @Get(':feedId/subscribers')
  @UseGuards(UserManagesFeedServerGuard)
  async getFeedSubscribers(
    @Param('feedId', GetFeedPipe) feed: DetailedFeed,
  ): Promise<GetFeedSubscribersOutputDto> {
    const subscribers = await this.feedSubscribersService.getSubscribersOfFeed(
      feed._id,
    );

    return GetFeedSubscribersOutputDto.fromEntity(subscribers);
  }
}

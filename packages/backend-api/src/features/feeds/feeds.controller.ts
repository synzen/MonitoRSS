import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { DiscordOAuth2Guard } from '../../common/guards/DiscordOAuth2.guard';
import { TransformValidationPipe } from '../../common/pipes/TransformValidationPipe';
import { GetFeedOutputDto } from './dto/GetFeedOutput.dto';
import { UpdateFeedInputDto } from './dto/UpdateFeedInput.dto';
import { UpdateFeedOutputDto } from './dto/UpdateFeedOutput.dto';
import { FeedsService } from './feeds.service';
import { UserManagesFeedServerGuard } from './guards/UserManagesFeedServer.guard';
import { GetFeedPipe } from './pipes/GetFeed.pipe';
import { FeedWithRefreshRate } from './types/FeedWithRefreshRate';

@Controller('feeds')
@UseGuards(DiscordOAuth2Guard)
export class FeedsController {
  constructor(private readonly feedsService: FeedsService) {}

  @Get(':feedId')
  @UseGuards(UserManagesFeedServerGuard)
  async getFeed(
    @Param('feedId', GetFeedPipe) feed: FeedWithRefreshRate,
  ): Promise<GetFeedOutputDto> {
    return GetFeedOutputDto.fromEntity(feed);
  }

  @Patch(':feedId')
  @UseGuards(UserManagesFeedServerGuard)
  async updateFeed(
    @Param('feedId', GetFeedPipe) feed: FeedWithRefreshRate,
    @Body(TransformValidationPipe) updateFeedInput: UpdateFeedInputDto,
  ): Promise<UpdateFeedOutputDto> {
    const updatedFeed = await this.feedsService.updateOne(feed._id, {
      text: updateFeedInput.text,
    });

    return GetFeedOutputDto.fromEntity(updatedFeed);
  }
}

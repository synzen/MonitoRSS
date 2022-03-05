import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { DiscordOAuth2Guard } from '../discord-auth/guards/DiscordOAuth2.guard';
import { TransformValidationPipe } from '../../common/pipes/TransformValidationPipe';
import { FeedFetcherService } from '../../services/feed-fetcher/feed-fetcher.service';
import { GetFeedArticlesOutputDto } from './dto/GetFeedArticlesOutput.dto';
import { GetFeedOutputDto } from './dto/GetFeedOutput.dto';
import { UpdateFeedInputDto } from './dto/UpdateFeedInput.dto';
import { UpdateFeedOutputDto } from './dto/UpdateFeedOutput.dto';
import { FeedsService } from './feeds.service';
import { UserManagesFeedServerGuard } from './guards/UserManagesFeedServer.guard';
import { GetFeedPipe } from './pipes/GetFeed.pipe';
import { FeedWithRefreshRate } from './types/FeedWithRefreshRate';
import { SupportersService } from '../supporters/supporters.service';
import { DiscordWebhooksService } from '../discord-webhooks/discord-webhooks.service';

@Controller('feeds')
@UseGuards(DiscordOAuth2Guard)
export class FeedsController {
  constructor(
    private readonly feedsService: FeedsService,
    private readonly feedFetcherService: FeedFetcherService,
    private readonly supportersService: SupportersService,
    private readonly webhooksService: DiscordWebhooksService,
  ) {}

  @Get(':feedId')
  @UseGuards(UserManagesFeedServerGuard)
  async getFeed(
    @Param('feedId', GetFeedPipe) feed: FeedWithRefreshRate,
  ): Promise<GetFeedOutputDto> {
    return GetFeedOutputDto.fromEntity(feed);
  }

  @Get(':feedId/refresh')
  @UseGuards(UserManagesFeedServerGuard)
  async refreshFeed(
    @Param('feedId', GetFeedPipe) feed: FeedWithRefreshRate,
  ): Promise<GetFeedOutputDto> {
    const updatedFeed = await this.feedsService.refresh(feed._id);

    return GetFeedOutputDto.fromEntity(updatedFeed);
  }

  @Patch(':feedId')
  @UseGuards(UserManagesFeedServerGuard)
  async updateFeed(
    @Param('feedId', GetFeedPipe) feed: FeedWithRefreshRate,
    @Body(TransformValidationPipe) updateFeedInput: UpdateFeedInputDto,
  ): Promise<UpdateFeedOutputDto> {
    if (updateFeedInput.webhookId) {
      if (!(await this.supportersService.serverCanUseWebhooks(feed.guild))) {
        throw new BadRequestException(
          'This server does not have webhooks enabled',
        );
      }

      const foundWebhook = await this.webhooksService.getWebhook(
        updateFeedInput.webhookId,
      );

      if (!foundWebhook) {
        throw new BadRequestException('Webhook not found');
      }
    }

    const updatedFeed = await this.feedsService.updateOne(feed._id, {
      text: updateFeedInput.text,
      webhook: {
        id: updateFeedInput.webhookId,
      },
    });

    return GetFeedOutputDto.fromEntity(updatedFeed);
  }

  @Get('/:feedId/articles')
  @UseGuards(UserManagesFeedServerGuard)
  async getFeedArticles(
    @Param('feedId', GetFeedPipe) feed: FeedWithRefreshRate,
  ): Promise<GetFeedArticlesOutputDto> {
    const { articles } = await this.feedFetcherService.fetchFeed(feed.url, {
      formatTables: feed.formatTables,
      imgLinksExistence: feed.imgLinksExistence,
      imgPreviews: feed.imgPreviews,
    });

    return {
      result: articles.map((a) => a.toJSON()),
    };
  }
}

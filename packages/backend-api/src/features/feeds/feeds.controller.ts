import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { DiscordOAuth2Guard } from '../../common/guards/DiscordOAuth2.guard';
import { FeedEmbedTimestamp, GetFeedOutputDto } from './dto/GetFeedOutput.dto';
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
    return {
      result: {
        refreshRateSeconds: feed.refreshRateSeconds,
        text: feed.text || '',
        checkDates: feed.checkDates,
        checkTitles: feed.checkTitles,
        directSubscribers: feed.directSubscribers,
        disabled: feed.disabled,
        formatTables: feed.formatTables,
        imgLinksExistence: feed.imgLinksExistence,
        imgPreviews: feed.imgPreviews,
        ncomparisons: feed.ncomparisons || [],
        pcomparisons: feed.pcomparisons || [],
        embeds: feed.embeds.map((embed) => ({
          title: embed.title,
          description: embed.description,
          url: embed.url,
          thumbnail: {
            url: embed.thumbnailURL,
          },
          author: {
            iconUrl: embed.authorIconURL,
            name: embed.authorName,
            url: embed.authorURL,
          },
          fields: embed.fields || [],
          color: embed.color,
          footer: {
            text: embed.footerText,
            iconUrl: embed.footerIconURL,
          },
          image: {
            url: embed.imageURL,
          },
          timestamp: embed.timestamp as FeedEmbedTimestamp,
        })),
      },
    };
  }
}

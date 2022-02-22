import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { NestedQuery } from '../../common/decorators/NestedQuery';
import { TransformValidationPipe } from '../../common/pipes/TransformValidationPipe';
import { DiscordServersService } from './discord-servers.service';
import { GetServerFeedsInputDto } from './dto/GetServerFeedsInput.dto';
import { GetServerFeedsOutputDto } from './dto/GetServerFeedsOutput.dto';
import { BotHasServerGuard } from './guards/BotHasServer.guard';

@Controller('discord-servers')
export class DiscordServersController {
  constructor(private readonly discordServersService: DiscordServersService) {}

  @Get(':serverId/feeds')
  @UseGuards(BotHasServerGuard)
  async getServerFeeds(
    @Param('serverId') serverId: string,
    @NestedQuery(TransformValidationPipe)
    getServerFeedsInput: GetServerFeedsInputDto,
  ): Promise<GetServerFeedsOutputDto> {
    const [serverFeeds, totalFeeds] = await Promise.all([
      this.discordServersService.getServerFeeds(serverId, {
        limit: getServerFeedsInput.limit,
        offset: getServerFeedsInput.offset,
      }),
      this.discordServersService.countServerFeeds(serverId),
    ]);

    return {
      results: serverFeeds.map((feed) => ({
        id: feed._id.toHexString(),
        channel: feed.channel,
        createdAt: feed.addedAt?.toISOString(),
        status: feed.status,
        title: feed.title,
        url: feed.url,
      })),
      total: totalFeeds,
    };
  }
}

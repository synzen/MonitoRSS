import { HttpStatus, Injectable } from '@nestjs/common';
import { DiscordAPIError } from '../../common/errors/DiscordAPIError';
import { DiscordGuild } from '../../common/types/DiscordGuild';
import { DiscordAPIService } from '../../services/apis/discord/discord-api.service';
import { Feed } from '../feeds/entities/Feed.entity';
import { FeedsService } from '../feeds/feeds.service';
import { FeedStatus } from '../feeds/types/FeedStatus.type';
import { DiscordServerChannel } from './types/DiscordServerChannel.type';

@Injectable()
export class DiscordServersService {
  constructor(
    private readonly discordApiService: DiscordAPIService,
    private readonly feedsService: FeedsService,
  ) {}

  async getServerFeeds(
    serverId: string,
    options: {
      search?: string;
      limit: number;
      offset: number;
    },
  ): Promise<(Feed & { status: FeedStatus })[]> {
    return this.feedsService.getServerFeeds(serverId, options);
  }

  async countServerFeeds(
    serverId: string,
    options?: {
      search?: string;
    },
  ): Promise<number> {
    return this.feedsService.countServerFeeds(serverId, {
      search: options?.search,
    });
  }

  async getServer(serverId: string) {
    try {
      const guild: DiscordGuild =
        await this.discordApiService.executeBotRequest(`/guilds/${serverId}`);

      return guild;
    } catch (err) {
      const statusCodeForNull = [HttpStatus.NOT_FOUND, HttpStatus.FORBIDDEN];

      if (
        err instanceof DiscordAPIError &&
        statusCodeForNull.includes(err.statusCode)
      ) {
        return null;
      }

      throw err;
    }
  }

  async getChannelsOfServer(serverId: string) {
    const channels: DiscordServerChannel[] =
      await this.discordApiService.executeBotRequest(
        `/guilds/${serverId}/channels`,
      );

    return channels;
  }
}

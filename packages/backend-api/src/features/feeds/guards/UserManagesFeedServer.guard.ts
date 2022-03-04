import { Injectable, NotFoundException } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { BaseUserManagesServerGuard } from '../../discord-auth/guards/BaseUserManagesServer.guard';
import { DiscordAuthService } from '../../discord-auth/discord-auth.service';
import { FeedsService } from '../feeds.service';

@Injectable()
export class UserManagesFeedServerGuard extends BaseUserManagesServerGuard {
  constructor(
    private readonly feedsService: FeedsService,
    protected readonly discordAuthService: DiscordAuthService,
  ) {
    super(discordAuthService);
  }

  async getServerId(request: FastifyRequest): Promise<string | undefined> {
    const { feedId } = request.params as Record<string, never>;

    if (!feedId) {
      throw new Error(
        'Feed ID is missing while validating if user manages server',
      );
    }

    const feed = await this.feedsService.getFeed(feedId);

    if (!feed) {
      throw new NotFoundException(`Feed ${feedId} not found`);
    }

    return feed.guild;
  }
}

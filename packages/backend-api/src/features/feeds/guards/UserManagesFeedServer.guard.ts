import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { getAccessTokenFromRequest } from '../../../utils/get-access-token-from-session';
import { DiscordUsersService } from '../../discord-users/discord-users.service';
import { FeedsService } from '../feeds.service';

@Injectable()
export class UserManagesFeedServerGuard implements CanActivate {
  constructor(
    private readonly discordUsersService: DiscordUsersService,
    private readonly feedsService: FeedsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest() as FastifyRequest;

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

    const accessToken = this.getUserAccessToken(request);
    const managesGuild = await this.discordUsersService.managesGuild(
      accessToken,
      feed.guild,
    );

    if (!managesGuild) {
      throw new ForbiddenException();
    }

    return true;
  }

  private getUserAccessToken(request: FastifyRequest) {
    const accessToken = getAccessTokenFromRequest(request);

    if (!accessToken) {
      throw new UnauthorizedException();
    }

    return accessToken.access_token;
  }
}

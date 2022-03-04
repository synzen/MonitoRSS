import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { DiscordUsersService } from '../../features/discord-users/discord-users.service';
import { getAccessTokenFromRequest } from '../../utils/get-access-token-from-session';

@Injectable()
export abstract class BaseUserManagesServerGuard implements CanActivate {
  constructor(private readonly discordUsersService: DiscordUsersService) {}

  abstract getServerId(request: FastifyRequest): string | undefined;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest() as FastifyRequest;

    const serverId = this.getServerId(request);

    if (!serverId) {
      throw new Error(
        'Server ID is missing while validating if user manages server',
      );
    }

    const accessToken = this.getUserAccessToken(request);
    const managesGuild = await this.discordUsersService.managesGuild(
      accessToken,
      serverId,
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

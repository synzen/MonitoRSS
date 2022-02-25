import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { getAccessTokenFromRequest } from '../../../utils/get-access-token-from-session';
import { DiscordUsersService } from '../../discord-users/discord-users.service';

@Injectable()
export class UserManagesServerGuard implements CanActivate {
  constructor(private readonly discordUsersService: DiscordUsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest() as FastifyRequest;

    const { serverId } = request.params as Record<string, never>;

    if (!serverId) {
      throw new Error(
        'Server ID is missing while validating if user manages server',
      );
    }

    const accessToken = this.getUserAccessToken(request);
    const guilds = await this.discordUsersService.getGuilds(accessToken);

    if (!guilds.find((guild) => guild.id === serverId)) {
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

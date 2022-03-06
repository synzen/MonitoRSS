import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { getAccessTokenFromRequest } from '../../discord-auth/utils/get-access-token-from-session';
import { SupportersService } from '../../supporters/supporters.service';
import { DiscordUsersService } from '../discord-users.service';

@Injectable()
export class DiscordUserIsSupporterGuard implements CanActivate {
  constructor(
    private readonly usersService: DiscordUsersService,
    private readonly supportersService: SupportersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest() as FastifyRequest;

    const token = getAccessTokenFromRequest(request);

    if (!token) {
      throw new UnauthorizedException();
    }

    const user = await this.usersService.getUser(token.access_token);

    const benefits = await this.supportersService.getBenefitsOfDiscordUser(
      user.id,
    );

    return benefits.isSupporter;
  }
}

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { DiscordServersService } from '../discord-servers.service';

@Injectable()
export class BotHasServerGuard implements CanActivate {
  constructor(private readonly discordServersService: DiscordServersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest() as FastifyRequest;

    const { serverId } = request.params as Record<string, never>;

    if (!serverId) {
      throw new Error(
        'Server ID is missing while validating if bot has server',
      );
    }

    const server = await this.discordServersService.getServer(serverId);

    if (!server) {
      throw new NotFoundException('Server not found');
    }

    return true;
  }
}

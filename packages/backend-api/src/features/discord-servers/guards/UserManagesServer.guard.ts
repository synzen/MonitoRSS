import { Injectable } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { BaseUserManagesServerGuard } from '../../discord-auth/guards/BaseUserManagesServer.guard';

@Injectable()
export class UserManagesServerGuard extends BaseUserManagesServerGuard {
  async getServerId(request: FastifyRequest) {
    const { serverId } = request.params as Record<string, never>;

    return serverId;
  }
}

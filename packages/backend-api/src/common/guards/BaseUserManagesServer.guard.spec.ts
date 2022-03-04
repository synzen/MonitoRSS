import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { mocked } from 'ts-jest/utils';
import { BaseUserManagesServerGuard } from './BaseUserManagesServer.guard';
import { FastifyRequest } from 'fastify';
import { getAccessTokenFromRequest } from '../../utils/get-access-token-from-session';
import { DiscordAuthService } from '../../features/discord-auth/discord-auth.service';

jest.mock('../../utils/get-access-token-from-session');

const mockedGetAccessTokenFromRequest = mocked(getAccessTokenFromRequest);

class TestUserManagesServer extends BaseUserManagesServerGuard {
  async getServerId(request: FastifyRequest) {
    return (request.params as Record<string, never>).serverId;
  }
}

describe('BaseUserManagesServerGuard', () => {
  let guard: TestUserManagesServer;
  let discordAuthService: DiscordAuthService;
  const getRequest = jest.fn();
  let context: ExecutionContext;
  const serverId = 'server-id';

  beforeEach(() => {
    getRequest.mockReturnValue({
      params: {
        serverId,
      },
    });

    context = {
      switchToHttp: () => ({
        getRequest,
      }),
    } as never;

    discordAuthService = {
      userManagesGuild: jest.fn(),
    } as never;

    mockedGetAccessTokenFromRequest.mockReturnValue({
      access_token: 'access-token',
    } as never);

    jest.spyOn(discordAuthService, 'userManagesGuild').mockResolvedValue(true);

    guard = new TestUserManagesServer(discordAuthService);
  });

  it('returns true if guild was found', async () => {
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('throws bad request if guild was not found', async () => {
    jest.spyOn(discordAuthService, 'userManagesGuild').mockResolvedValue(false);

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws if server id is missing from request params', async () => {
    getRequest.mockReturnValue({
      params: {},
    });

    await expect(guard.canActivate(context)).rejects.toThrow();
  });

  it('throws unauthorized if access token was not found', async () => {
    mockedGetAccessTokenFromRequest.mockReturnValue(undefined);
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

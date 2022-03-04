import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { mocked } from 'ts-jest/utils';
import { BaseUserManagesServerGuard } from './BaseUserManagesServer.guard';
import { FastifyRequest } from 'fastify';
import { getAccessTokenFromRequest } from '../../utils/get-access-token-from-session';
import { DiscordUsersService } from '../../features/discord-users/discord-users.service';

jest.mock('../../utils/get-access-token-from-session');

const mockedGetAccessTokenFromRequest = mocked(getAccessTokenFromRequest);

class TestUserManagesServer extends BaseUserManagesServerGuard {
  getServerId(request: FastifyRequest): string | undefined {
    return (request.params as Record<string, never>).serverId;
  }
}

describe('BaseUserManagesServerGuard', () => {
  let guard: TestUserManagesServer;
  let discordUsersService: DiscordUsersService;
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

    discordUsersService = {
      managesGuild: jest.fn(),
    } as never;

    mockedGetAccessTokenFromRequest.mockReturnValue({
      access_token: 'access-token',
    } as never);

    jest.spyOn(discordUsersService, 'managesGuild').mockResolvedValue(true);

    guard = new TestUserManagesServer(discordUsersService);
  });

  it('returns true if guild was found', async () => {
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('throws bad request if guild was not found', async () => {
    jest.spyOn(discordUsersService, 'managesGuild').mockResolvedValue(false);

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

import {
  BadRequestException,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { getAccessTokenFromRequest } from '../../../utils/get-access-token-from-session';
import { DiscordUsersService } from '../../discord-users/discord-users.service';
import { UserManagesServerGuard } from './UserManagesServer.guard';
import { mocked } from 'ts-jest/utils';

jest.mock('../../../utils/get-access-token-from-session');

const mockedGetAccessTokenFromRequest = mocked(getAccessTokenFromRequest);

describe('UserManagesServerGuard', () => {
  let guard: UserManagesServerGuard;
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
      getGuilds: jest.fn(),
    } as never;

    mockedGetAccessTokenFromRequest.mockReturnValue({
      access_token: 'access-token',
    } as never);

    jest.spyOn(discordUsersService, 'getGuilds').mockResolvedValue([
      {
        id: serverId,
      },
    ] as never);

    guard = new UserManagesServerGuard(discordUsersService);
  });

  it('returns true if guild was found', async () => {
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('throws bad request if guild was not found', async () => {
    jest.spyOn(discordUsersService, 'getGuilds').mockResolvedValue([]);

    await expect(guard.canActivate(context)).rejects.toThrow(
      BadRequestException,
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

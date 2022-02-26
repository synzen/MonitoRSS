import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { getAccessTokenFromRequest } from '../../../utils/get-access-token-from-session';
import { DiscordUsersService } from '../../discord-users/discord-users.service';
import { mocked } from 'ts-jest/utils';
import { UserManagesFeedServerGuard } from './UserManagesFeedServer.guard';
import { FeedsService } from '../feeds.service';

jest.mock('../../../utils/get-access-token-from-session');

const mockedGetAccessTokenFromRequest = mocked(getAccessTokenFromRequest);

describe('UserManagesFeedServerGuard', () => {
  let guard: UserManagesFeedServerGuard;
  let discordUsersService: DiscordUsersService;
  let feedsService: FeedsService;
  const getRequest = jest.fn();
  let context: ExecutionContext;
  const feedId = 'feed-id';

  beforeEach(() => {
    getRequest.mockReturnValue({
      params: {
        feedId,
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

    feedsService = {
      getFeed: jest.fn(),
    } as never;

    mockedGetAccessTokenFromRequest.mockReturnValue({
      access_token: 'access-token',
    } as never);

    jest.spyOn(feedsService, 'getFeed').mockResolvedValue({
      id: 'feed-id',
      guild: '123',
    } as never);
    jest.spyOn(discordUsersService, 'managesGuild').mockResolvedValue(true);

    guard = new UserManagesFeedServerGuard(discordUsersService, feedsService);
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

  it('throws not found exception if feed is not found', async () => {
    jest.spyOn(feedsService, 'getFeed').mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
  });

  it('throws if feed id is missing from request params', async () => {
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

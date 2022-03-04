import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { mocked } from 'ts-jest/utils';
import { getAccessTokenFromRequest } from '../utils/get-access-token-from-session';
import { discordAccessTokenFactory } from './DiscordAccessToken';

jest.mock('../utils/get-access-token-from-session');

const mockedGetAccessTokenFromRequest = mocked(getAccessTokenFromRequest);

describe('DiscordAccessToken decorator', () => {
  let context: ExecutionContext;
  const storedAccessToken = {
    access_token: 'abc',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    context = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as never;
  });

  it('throws unauthorized if there is no access token', () => {
    expect(() => {
      discordAccessTokenFactory(context, context);
    }).toThrowError(UnauthorizedException);
  });

  it('returns the access token', () => {
    mockedGetAccessTokenFromRequest.mockReturnValue(storedAccessToken as never);
    const accessToken = discordAccessTokenFactory(context, context);

    expect(accessToken).toBe(storedAccessToken.access_token);
  });
});

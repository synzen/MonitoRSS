import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { discordAccessTokenFactory } from './DiscordAccessToken';

describe('DiscordAccessToken decorator', () => {
  let context: ExecutionContext;
  const storedAccessToken = {
    access_token: 'abc',
  };
  const sessionGet = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    context = {
      switchToHttp: () => ({
        getRequest: () => ({
          session: {
            get: sessionGet,
          },
        }),
      }),
    } as never;
  });

  it('throws unauthorized if there is no access token', () => {
    expect(() => {
      discordAccessTokenFactory(context, context);
    }).toThrowError(UnauthorizedException);
  });

  it('returns the access token', () => {
    sessionGet.mockReturnValue(storedAccessToken);
    const accessToken = discordAccessTokenFactory(context, context);

    expect(accessToken).toBe(storedAccessToken.access_token);
  });
});

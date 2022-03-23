import nock from 'nock';
import { URLSearchParams } from 'url';
import {
  DISCORD_API_BASE_URL,
  DISCORD_TOKEN_ENDPOINT,
  DISCORD_TOKEN_REVOCATION_ENDPOINT,
} from '../../constants/discord';
import { DiscordUser } from '../discord-users/types/DiscordUser.type';
import { MANAGE_CHANNEL } from './constants/permissions';
import { DiscordAuthService, DiscordAuthToken } from './discord-auth.service';

describe('DiscordAuthService', () => {
  let service: DiscordAuthService;
  const discordApiService = {
    executeBearerRequest: jest.fn(),
  };
  const configService = {
    get: jest.fn(),
  };
  const mockDiscordUser: DiscordUser = {
    id: 'mock-discord-user-id',
    discriminator: 'mock-discord-user-discriminator',
    username: 'mock-discord-user-username',
  };

  beforeEach(() => {
    nock.cleanAll();
    service = new DiscordAuthService(
      configService as never,
      discordApiService as never,
    );
    service.CLIENT_ID = 'client-id';
    service.CLIENT_SECRET = 'client-secret';
  });

  describe('createAccessToken', () => {
    const mockAuthorizationCode = 'mock-authorization-code';
    let expectedUrlSearchParams: URLSearchParams;
    let mockDiscordToken: DiscordAuthToken;

    beforeEach(() => {
      mockDiscordToken = {
        access_token: 'mock-access-token',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token',
        scope: service.OAUTH_SCOPES,
        token_type: 'Bearer',
      };

      expectedUrlSearchParams = new URLSearchParams({
        client_id: service.CLIENT_ID,
        client_secret: service.CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: mockAuthorizationCode,
        redirect_uri: service.OAUTH_REDIRECT_URI,
        scope: service.OAUTH_SCOPES,
      });

      nock(DISCORD_API_BASE_URL)
        .post(DISCORD_TOKEN_ENDPOINT, expectedUrlSearchParams.toString())
        .matchHeader('Content-Type', 'application/x-www-form-urlencoded')
        .reply(200, mockDiscordToken);
    });

    it('should return the formatted auth token', async () => {
      jest
        .spyOn(discordApiService, 'executeBearerRequest')
        .mockResolvedValue(mockDiscordUser);

      const discordToken = await service.createAccessToken(
        mockAuthorizationCode,
      );

      expect(discordToken).toEqual(
        expect.objectContaining({
          ...mockDiscordToken,
          expiresAt: expect.any(Number),
          discord: {
            id: mockDiscordUser.id,
          },
        }),
      );
    });

    it('throws if the status code is not ok', async () => {
      nock.cleanAll();
      nock(DISCORD_API_BASE_URL)
        .post(DISCORD_TOKEN_ENDPOINT, expectedUrlSearchParams.toString())
        .matchHeader('Content-Type', 'application/x-www-form-urlencoded')
        .reply(400, {
          error: 'invalid_grant',
        });

      await expect(
        service.createAccessToken(mockAuthorizationCode),
      ).rejects.toThrowError();
    });
  });

  describe('refreshToken', () => {
    let expectedUrlSearchParams: URLSearchParams;
    let mockDiscordToken: DiscordAuthToken;

    beforeEach(() => {
      mockDiscordToken = {
        access_token: 'mock-access-token',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token',
        scope: service.OAUTH_SCOPES,
        token_type: 'Bearer',
      };

      expectedUrlSearchParams = new URLSearchParams({
        client_id: service.CLIENT_ID,
        client_secret: service.CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: mockDiscordToken.refresh_token,
        redirect_uri: service.OAUTH_REDIRECT_URI,
        scope: service.OAUTH_SCOPES,
      });

      nock(DISCORD_API_BASE_URL)
        .post(DISCORD_TOKEN_ENDPOINT, expectedUrlSearchParams.toString())
        .matchHeader('Content-Type', 'application/x-www-form-urlencoded')
        .reply(200, mockDiscordToken);
    });

    it('should return the formatted auth token', async () => {
      jest
        .spyOn(discordApiService, 'executeBearerRequest')
        .mockResolvedValue(mockDiscordUser);
      const discordToken = await service.refreshToken(mockDiscordToken);

      expect(discordToken).toEqual(
        expect.objectContaining({
          ...mockDiscordToken,
          expiresAt: expect.any(Number),
          discord: {
            id: mockDiscordUser.id,
          },
        }),
      );
    });

    it('throws if the status code is not ok', async () => {
      nock.cleanAll();
      nock(DISCORD_API_BASE_URL)
        .post(DISCORD_TOKEN_ENDPOINT, expectedUrlSearchParams.toString())
        .matchHeader('Content-Type', 'application/x-www-form-urlencoded')
        .reply(400, {
          error: 'invalid_grant',
        });

      await expect(
        service.refreshToken(mockDiscordToken),
      ).rejects.toThrowError();
    });
  });

  describe('isTokenExpired', () => {
    it('returns true correctly', () => {
      const token = {
        expiresAt: new Date().getTime() / 1000 - 10000,
      };
      expect(service.isTokenExpired(token as never)).toBe(true);
    });

    it('returns false correctly', () => {
      const token = {
        expiresAt: new Date().getTime() / 1000 + 10000,
      };
      expect(service.isTokenExpired(token as never)).toBe(false);
    });
  });

  describe('revokeToken', () => {
    let expectedAccessTokenUrlSearchParams: URLSearchParams;
    let expectedRefreshTokenUrlSearchParams: URLSearchParams;
    let mockDiscordToken: DiscordAuthToken;

    beforeEach(() => {
      mockDiscordToken = {
        access_token: 'mock-access-token',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token',
        scope: service.OAUTH_SCOPES,
        token_type: 'Bearer',
      };

      expectedAccessTokenUrlSearchParams = new URLSearchParams({
        token: mockDiscordToken.access_token,
        client_id: service.CLIENT_ID,
        client_secret: service.CLIENT_SECRET,
      });

      expectedRefreshTokenUrlSearchParams = new URLSearchParams({
        token: mockDiscordToken.refresh_token,
        client_id: service.CLIENT_ID,
        client_secret: service.CLIENT_SECRET,
      });
    });

    it('resolves to nothing on success', async () => {
      nock(DISCORD_API_BASE_URL)
        .post(
          DISCORD_TOKEN_REVOCATION_ENDPOINT,
          expectedAccessTokenUrlSearchParams.toString(),
        )
        .matchHeader('Content-Type', 'application/x-www-form-urlencoded')
        .reply(200, {})
        .persist();
      nock(DISCORD_API_BASE_URL)
        .post(
          DISCORD_TOKEN_REVOCATION_ENDPOINT,
          expectedRefreshTokenUrlSearchParams.toString(),
        )
        .matchHeader('Content-Type', 'application/x-www-form-urlencoded')
        .reply(200, {});

      await expect(
        service.revokeToken(mockDiscordToken),
      ).resolves.toBeUndefined();
    });

    it('throws if the status code of revoking the access token is not ok', async () => {
      nock.cleanAll();
      nock(DISCORD_API_BASE_URL)
        .post(
          DISCORD_TOKEN_REVOCATION_ENDPOINT,
          expectedAccessTokenUrlSearchParams.toString(),
        )
        .matchHeader('Content-Type', 'application/x-www-form-urlencoded')
        .reply(400, {
          error: 'invalid_grant',
        });

      nock(DISCORD_API_BASE_URL)
        .post(
          DISCORD_TOKEN_REVOCATION_ENDPOINT,
          expectedRefreshTokenUrlSearchParams.toString(),
        )
        .matchHeader('Content-Type', 'application/x-www-form-urlencoded')
        .reply(200, mockDiscordToken);

      await expect(
        service.revokeToken(mockDiscordToken),
      ).rejects.toThrowError();
    });

    it('throws if the status code of revoking the refresh token is not ok', async () => {
      nock.cleanAll();
      nock(DISCORD_API_BASE_URL)
        .post(
          DISCORD_TOKEN_REVOCATION_ENDPOINT,
          expectedAccessTokenUrlSearchParams.toString(),
        )
        .matchHeader('Content-Type', 'application/x-www-form-urlencoded')
        .reply(200, mockDiscordToken);
      nock(DISCORD_API_BASE_URL)
        .post(
          DISCORD_TOKEN_REVOCATION_ENDPOINT,
          expectedRefreshTokenUrlSearchParams.toString(),
        )
        .matchHeader('Content-Type', 'application/x-www-form-urlencoded')
        .reply(400, {
          error: 'invalid_grant',
        });

      await expect(
        service.revokeToken(mockDiscordToken),
      ).rejects.toThrowError();
    });
  });

  describe('userManagesGuild', () => {
    it('returns true if the guild was found', async () => {
      const accessToken = 'abc';
      const guilds = [
        {
          id: 'guild_id',
          name: 'test',
          icon: 'icon_hash',
          owner: false,
          permissions: MANAGE_CHANNEL.toString(),
        },
      ];
      jest
        .spyOn(discordApiService, 'executeBearerRequest')
        .mockResolvedValue(guilds);
      const result = await service.userManagesGuild(accessToken, guilds[0].id);

      expect(result).toBe(true);
    });
    it('returns false if the guild was not found', async () => {
      const accessToken = 'abc';
      jest
        .spyOn(discordApiService, 'executeBearerRequest')
        .mockResolvedValue([]);
      const result = await service.userManagesGuild(accessToken, 'random-id');

      expect(result).toBe(false);
    });
  });
});

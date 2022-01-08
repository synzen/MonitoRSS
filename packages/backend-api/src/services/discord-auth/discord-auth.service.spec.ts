import nock from 'nock';
import {
  DISCORD_API_BASE_URL,
  DISCORD_TOKEN_ENDPOINT,
} from 'src/constants/discord';
import DiscordAuthService, { DiscordAuthToken } from './discord-auth.service';

describe('DiscordAuthService', () => {
  let service: DiscordAuthService;
  const configService = {
    get: jest.fn(),
  };

  beforeEach(() => {
    service = new DiscordAuthService(configService as any);
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
      const discordToken = await service.createAccessToken(
        mockAuthorizationCode,
      );

      expect(discordToken).toEqual(
        expect.objectContaining({
          ...mockDiscordToken,
          expiresAt: expect.any(Number),
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
      const discordToken = await service.refreshToken(mockDiscordToken);

      expect(discordToken).toEqual(
        expect.objectContaining({
          ...mockDiscordToken,
          expiresAt: expect.any(Number),
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
});

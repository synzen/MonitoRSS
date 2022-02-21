import nock from 'nock';
import { DISCORD_API_BASE_URL } from '../../../constants/discord';
import { DiscordAPIService } from './discord-api.service';
describe('DiscordAPIService', () => {
  let discordApi: DiscordAPIService;
  const configService = {
    get: jest.fn(),
  };

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    discordApi = new DiscordAPIService(configService as any);
  });

  describe('executeBotRequest', () => {
    it('throws an error if status code is not ok', async () => {
      const endpoint = `/guilds/123456789/members/123456789`;

      nock(DISCORD_API_BASE_URL)
        .get(endpoint)
        .matchHeader('Authorization', `Bot ${discordApi.BOT_TOKEN}`)
        .matchHeader('Content-Type', 'application/json')
        .reply(500, {
          message: 'Internal server error',
        });

      await expect(discordApi.executeBotRequest(endpoint)).rejects.toThrow();
    });

    it('returns the response', async () => {
      const endpoint = `/guilds/123456789/members/123456789`;

      nock(DISCORD_API_BASE_URL)
        .get(endpoint)
        .matchHeader('Authorization', `Bot ${discordApi.BOT_TOKEN}`)
        .matchHeader('Content-Type', 'application/json')
        .reply(200, {
          message: 'Success',
        });

      const response = await discordApi.executeBotRequest(endpoint);
      expect(response).toEqual({
        message: 'Success',
      });
    });
  });

  describe('executeBearerRequest', () => {
    it('throws an error if status code is not ok', async () => {
      const accessToken = 'mock-access-token';
      const endpoint = `/guilds/123456789/members/123456789`;

      nock(DISCORD_API_BASE_URL)
        .get(endpoint)
        .matchHeader('Authorization', `Bearer ${accessToken}`)
        .matchHeader('Content-Type', 'application/json')
        .reply(500, {
          message: 'Internal server error',
        });

      await expect(
        discordApi.executeBearerRequest(accessToken, endpoint),
      ).rejects.toThrow();
    });

    it('returns the response', async () => {
      const accessToken = 'mock-access-token';
      const endpoint = `/guilds/123456789/members/123456789`;

      nock(DISCORD_API_BASE_URL)
        .get(endpoint)
        .matchHeader('Authorization', `Bearer ${accessToken}`)
        .matchHeader('Content-Type', 'application/json')
        .reply(200, {
          message: 'Success',
        });

      const response = await discordApi.executeBearerRequest(
        accessToken,
        endpoint,
      );
      expect(response).toEqual({
        message: 'Success',
      });
    });
  });
});

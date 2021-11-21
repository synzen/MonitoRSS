import 'reflect-metadata';
import SubscriptionService, { SubscriptionAPIResponse } from './SubscriptionService';
import { mocked } from 'ts-jest/utils';
import { request } from 'undici';

jest.mock('undici', () => ({
  request: jest.fn(),
}));

const mockedFetch = mocked(request, true);

describe('SubscriptionService', () => {
  const config = {
    apis: {
      subscriptions: {
        host: 'https://subscription.com',
        accessToken: 'accessToken',
      },
    },
  };
  let subscriptionService: SubscriptionService;
  let mockResponse: SubscriptionAPIResponse;
  console.error = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    subscriptionService = new SubscriptionService(config as any);
    mockResponse = {
      guild_id: 'abc',
      extra_feeds: 100,
      refresh_rate: 111,
      expire_at: new Date('2029-09-09').toISOString(),
      ignore_refresh_rate_benefit: false,
    };
  });

  describe('getSubscriptionOfGuild', () => {
    it('returns null if url is not configured', async () => {
      subscriptionService = new SubscriptionService({
        apis: {
          subscriptions: {
            enabled: false,
          },
        },
      } as any);
      await expect(subscriptionService.getSubscriptionOfGuild('')).resolves.toEqual(null);
    });
    it('returns null if 404', async () => {
      mockedFetch.mockResolvedValue({
        statusCode: 404,
        body: {
          json: jest.fn(),
        },
      } as any);
      await expect(subscriptionService.getSubscriptionOfGuild('')).resolves.toEqual(null);
    });
    it('returns null if an error was thrown', async () => {
      const error = new Error('asdsdf');
      mockedFetch.mockRejectedValue(error);
      await expect(subscriptionService.getSubscriptionOfGuild('')).resolves.toEqual(null);
    });
    it('returns a json body on success', async () => {
      mockedFetch.mockResolvedValue({
        statusCode: 200,
        body: {
          json: async () => mockResponse,
        },
      } as any);
      await expect(subscriptionService.getSubscriptionOfGuild(''))
        .resolves.toEqual(mockResponse);
    });
    it('calls the right url and options', async () => {
      mockedFetch.mockResolvedValue({
        statusCode: 200,
        json: async () => mockResponse,
      } as any);
      const guildId = '12345';
      await subscriptionService.getSubscriptionOfGuild(guildId);
      expect(mockedFetch).toHaveBeenCalledWith(
        `${config.apis.subscriptions.host}/guilds/${guildId}`, {
          method: 'GET',
          headers: {
            Authorization: config.apis.subscriptions.accessToken,
          },
        });
    });
  });
});

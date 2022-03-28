import { ConfigService } from '@nestjs/config';
import nock from 'nock';
import { GuildSubscriptionsService } from './guild-subscriptions.service';
import { GuildSubscription } from './types/guild-subscription.type';

jest.mock('../../utils/logger');
nock.disableNetConnect();

describe('GuildSubscriptionsService', () => {
  let mockResponse: GuildSubscription;
  let apiConfig: {
    apiHost: string;
    accessToken: string;
  };
  let service: GuildSubscriptionsService;
  const configService: ConfigService = {
    get: jest.fn(),
  } as never;

  beforeEach(() => {
    mockResponse = {
      guild_id: 'abc',
      extra_feeds: 100,
      refresh_rate: 111,
      expire_at: new Date('2029-09-09').toISOString(),
      ignore_refresh_rate_benefit: false,
    };
    apiConfig = {
      apiHost: 'https://www.myapihost.com',
      accessToken: 'accesstoken',
    };
    service = new GuildSubscriptionsService(configService);
    service.accessToken = apiConfig.accessToken;
    service.apiHost = apiConfig.apiHost;
    service.enabled = true;
  });

  afterEach(function () {
    jest.resetAllMocks();
    nock.cleanAll();
  });

  it('sets the enabled to true if required credentials exist', () => {
    jest.spyOn(configService, 'get').mockImplementation((key) => {
      if (key === 'apiSubscriptionsHost') {
        return 'host';
      }

      if (key === 'apiSubscriptionsAccessToken') {
        return 'token';
      }

      if (key === 'apiSubscriptionsEnabled') {
        return true;
      }
    });

    const thisService = new GuildSubscriptionsService(configService);
    expect(thisService.enabled).toBe(true);
  });

  it('sets enabled to false if some required credentials are missing', () => {
    jest.spyOn(configService, 'get').mockImplementation((key) => {
      if (key === 'apiSubscriptionsHost') {
        return 'host';
      }

      if (key === 'apiSubscriptionsAccessToken') {
        return undefined;
      }
    });

    const thisService = new GuildSubscriptionsService(configService);
    expect(thisService.enabled).toBe(false);
  });

  it('sets enabled to false if config env enabled is false', () => {
    jest.spyOn(configService, 'get').mockImplementation((key) => {
      if (key === 'apiSubscriptionsHost') {
        return 'host';
      }

      if (key === 'apiSubscriptionsAccessToken') {
        return 'token';
      }

      if (key === 'apiSubscriptionsEnabled') {
        return false;
      }
    });

    const thisService = new GuildSubscriptionsService(configService);
    expect(thisService.enabled).toBe(false);
  });

  describe('mapApiResponse', () => {
    it('returns correctly', () => {
      expect(service.mapApiResponse(mockResponse)).toEqual({
        guildId: mockResponse.guild_id,
        maxFeeds: service.baseMaxFeeds + mockResponse.extra_feeds,
        refreshRate: mockResponse.refresh_rate,
        expireAt: mockResponse.expire_at,
        slowRate: false,
      });
    });
    it('returns slow rate if ignore refresh rate is true', () => {
      mockResponse = {
        guild_id: 'abc',
        extra_feeds: 100,
        refresh_rate: 111,
        expire_at: new Date('2029-09-09').toISOString(),
        ignore_refresh_rate_benefit: true,
      };
      expect(service.mapApiResponse(mockResponse)).toEqual(
        expect.objectContaining({
          slowRate: true,
        }),
      );
    });
  });
  describe('static getSubscription', () => {
    const guildId = 'guild-id';
    const endpoint = `/guilds/${guildId}`;

    it('returns null if service is not enabled', async () => {
      service.enabled = false;
      await expect(service.getSubscription(guildId)).resolves.toEqual(null);
    });
    it('returns null if 404', async () => {
      nock(service.apiHost).get(endpoint).reply(404, {});
      await expect(service.getSubscription(guildId)).resolves.toEqual(null);
    });
    it('returns null if an error was thrown', async () => {
      nock(service.apiHost).get(endpoint).replyWithError('error');
      await expect(service.getSubscription(guildId)).resolves.toEqual(null);
    });
    it('returns the correctly formatted object on success', async () => {
      nock(service.apiHost).get(endpoint).reply(200, mockResponse);
      await expect(service.getSubscription(guildId)).resolves.toEqual(
        service.mapApiResponse(mockResponse),
      );
    });
    it('calls the right headers', async () => {
      nock(service.apiHost)
        .get(endpoint)
        .matchHeader('Authorization', apiConfig.accessToken)
        .reply(200, mockResponse);
      const guildId = '12345';
      await service.getSubscription(guildId);
    });
  });
  describe('getAllSubscriptions', () => {
    const endpoint = '/guilds?';

    it('returns empty array if an error ocurred', async () => {
      const error = new Error('fetch err');
      nock(service.apiHost).get(endpoint).replyWithError(error);
      await expect(service.getAllSubscriptions()).resolves.toEqual([]);
    });
    it('returns empty array if disabled', async () => {
      service.enabled = false;
      await expect(service.getAllSubscriptions()).resolves.toEqual([]);
    });
    it('returns the correctly formatted object on success', async () => {
      const allMockResponse = [mockResponse, mockResponse];
      service.enabled = true;
      nock(service.apiHost).get(endpoint).reply(200, allMockResponse);
      await expect(service.getAllSubscriptions()).resolves.toEqual(
        allMockResponse.map((res) => service.mapApiResponse(res)),
      );
    });
    it('calls the right url and options', async () => {
      const filters = {
        serverIds: ['123', '456'],
      };
      nock(service.apiHost)
        .get('/guilds')
        .query({
          filters,
        })
        .matchHeader('Authorization', service.accessToken)
        .reply(200, []);
      await service.getAllSubscriptions({
        filters,
      });
    });
  });
});

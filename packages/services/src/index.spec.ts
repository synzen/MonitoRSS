import { Config } from './config-schema';
import { MongoMemoryServer } from 'mongodb-memory-server';
import setup, { MonitoServices } from './index';
import { SubscriptionAPIResponse } from './services/SubscriptionService';
import { request } from 'undici';
import { mocked } from 'ts-jest/utils';

jest.mock('undici', () => ({
  request: jest.fn(),
}));

const requestMocked = mocked(request);

describe('Index integration', () => {
  let config: Config;
  let mongodb: MongoMemoryServer;
  let services: MonitoServices;

  beforeEach(async () => {
    mongodb = await MongoMemoryServer.create();
    const mongoUri = await mongodb.getUri();

    config = {
      apis: {
        subscriptions: {
          host: 'https://subscription-service.com',
          accessToken: 'access-token',
          enabled: true,
        },
      },
      defaultMaxFeeds: 5,
      defaultRefreshRateMinutes: 10,
      mongoUri,
    };

    services = await setup(config);
  });

  afterEach(async () => {
    await mongodb.stop();
    await services.mongoDbClient.close();
  });

  describe('GuildService', () => {
    const guildId = 'guild-id';

    it('returns the feed limit added with subscription\'s extra feeds', async () => {
      const subscriptionResponse: SubscriptionAPIResponse = {
        refresh_rate: 10,
        ignore_refresh_rate_benefit: false,
        guild_id: guildId,
        extra_feeds: 10,
        expire_at: new Date().toISOString(),
      };
      requestMocked.mockResolvedValueOnce({
        statusCode: 200,
        body: {
          json: async () => subscriptionResponse,
        },
      } as any);

      const limit = await services.guildService.getFeedLimit(guildId);
      expect(limit).toEqual(config.defaultMaxFeeds + subscriptionResponse.extra_feeds);
    });
    it('returns the default feed limit if no subscription or supporter', async () => {
      requestMocked.mockResolvedValueOnce({
        statusCode: 404,
      } as any);

      const limit = await services.guildService.getFeedLimit(guildId);
      expect(limit).toEqual(config.defaultMaxFeeds);
    });
    it('returns the supporter feed limit if supporter', async () => {
      requestMocked.mockResolvedValueOnce({
        statusCode: 404,
      } as any);
      const expireAt = new Date();
      expireAt.setFullYear(expireAt.getFullYear() + 1);

      const supporterToInsert = {
        guilds: [guildId],
        expireAt,
        maxFeeds: 100,
      };

      await services.mongoDbClient.db().collection('supporters')
        .insertOne(supporterToInsert);
      
      const limit = await services.guildService.getFeedLimit(guildId);
      expect(limit).toEqual(supporterToInsert.maxFeeds);
    });
    it('returns the patron limit if patron', async () => {
      requestMocked.mockResolvedValueOnce({
        statusCode: 404,
      } as any);

      const discordId = 'discord-id';

      const supporterToInsert = {
        _id: discordId,
        guilds: [guildId],
        patron: true,
      };

      await services.mongoDbClient.db().collection('supporters')
        .insertOne(supporterToInsert as any);

      const patronToInsert = {
        discord: discordId,
        status: 'active_patron',
        pledge: 500,
      };

      await services.mongoDbClient.db().collection('patrons')
        .insertOne(patronToInsert);
      
      const limit = await services.guildService.getFeedLimit(guildId);
      expect(limit).toEqual(35);
    });
  });
});

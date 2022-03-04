import { NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  setupEndpointTests,
  teardownEndpointTests,
} from '../../utils/endpoint-tests';
import { MongooseTestModule } from '../../utils/mongoose-test.module';
import nock from 'nock';
import { HttpStatus } from '@nestjs/common';
import { DISCORD_API_BASE_URL } from '../../constants/discord';
import { Session } from '../../common/types/Session';
import { PartialUserGuild } from '../discord-users/types/PartialUserGuild.type';
import { DiscordWebhooksModule } from './discord-webhooks.module';
import * as qs from 'qs';

describe('DiscordWebhooksModule', () => {
  let app: NestFastifyApplication;
  let setAccessToken: (accessToken: Session['accessToken']) => Promise<string>;
  const standardRequestOptions = {
    headers: {
      cookie: '',
    },
  };

  beforeEach(async () => {
    const { init } = setupEndpointTests({
      imports: [DiscordWebhooksModule, MongooseTestModule.forRoot()],
    });

    ({ app, setAccessToken } = await init());

    standardRequestOptions.headers.cookie = await setAccessToken({
      access_token: 'accessToken',
    } as Session['accessToken']);
  });

  afterEach(async () => {
    nock.cleanAll();
    await teardownEndpointTests();
  });

  describe('GET /discord-webhooks', () => {
    const serverId = '633432788015644722';
    const standardQuery = qs.stringify({
      filters: {
        serverId,
      },
    });

    const mockGetUserGuilds = (partialGuild?: Partial<PartialUserGuild>) => {
      nock(DISCORD_API_BASE_URL)
        .get(`/users/@me/guilds`)
        .reply(200, [
          {
            id: serverId,
            owner: true,
            permissions: 16,
            ...partialGuild,
          },
        ]);
    };

    it('returns forbidden if user does not own requested server', async () => {
      nock(DISCORD_API_BASE_URL).get(`/users/@me/guilds`).reply(200, []);

      const { statusCode } = await app.inject({
        method: 'GET',
        url: `/discord-webhooks?${standardQuery}`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.FORBIDDEN);
    });

    it('returns 400 if serverId filter is missing', async () => {
      mockGetUserGuilds();

      const badFilters = qs.stringify({
        filters: {},
      });

      const { statusCode } = await app.inject({
        method: 'GET',
        url: `/discord-webhooks?${badFilters}`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(400);
    });

    it('returns the correct response', async () => {
      mockGetUserGuilds();

      const { statusCode } = await app.inject({
        method: 'GET',
        url: `/discord-webhooks?${standardQuery}`,
        ...standardRequestOptions,
      });

      expect(statusCode).toEqual(200);
    });
  });
});

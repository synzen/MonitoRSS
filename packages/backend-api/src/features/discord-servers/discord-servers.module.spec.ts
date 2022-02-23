import { getModelToken } from '@nestjs/mongoose';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createTestFeed } from '../../test/data/feeds.test-data';
import {
  setupEndpointTests,
  teardownEndpointTests,
} from '../../utils/endpoint-tests';
import { MongooseTestModule } from '../../utils/mongoose-test.module';
import { Feed, FeedModel } from '../feeds/entities/Feed.entity';
import { DiscordServersModule } from './discord-servers.module';
import nock from 'nock';
import { DiscordAPIService } from '../../services/apis/discord/discord-api.service';
import { DiscordAPIError } from '../../common/errors/DiscordAPIError';
import { HttpStatus } from '@nestjs/common';
import { DISCORD_API_BASE_URL } from '../../constants/discord';
import { DiscordGuild } from '../../common/types/DiscordGuild';
import { Session } from '../../common/types/Session';

describe('DiscordServersModule', () => {
  let app: NestFastifyApplication;
  let feedModel: FeedModel;
  let discordApiService: DiscordAPIService;
  let setAccessToken: (accessToken: Session['accessToken']) => Promise<string>;
  const standardRequestOptions = {
    headers: {
      cookie: '',
    },
  };

  beforeEach(async () => {
    const { init } = setupEndpointTests({
      imports: [DiscordServersModule, MongooseTestModule.forRoot()],
    });

    ({ app, setAccessToken } = await init());

    // To do - set up an endpoint to use the session middleware, set the session, and then run tests

    standardRequestOptions.headers.cookie = await setAccessToken({
      access_token: 'accessToken',
    } as Session['accessToken']);

    feedModel = app.get<FeedModel>(getModelToken(Feed.name));
    discordApiService = app.get<DiscordAPIService>(DiscordAPIService);
  });

  afterEach(async () => {
    nock.cleanAll();
    await teardownEndpointTests();
  });

  describe('GET /discord-servers/:serverId/feeds', () => {
    const serverId = '633432788015644722';

    beforeEach(() => {
      // Mock the guild being returned in the BotHasServerGuard
      nock(DISCORD_API_BASE_URL)
        .get(`/guilds/${serverId}`)
        .reply(200, {
          id: serverId,
          name: 'Test Guild',
          icon: '',
          roles: [],
        } as DiscordGuild);
    });

    it('returns 400 if bot has no access to discord server', async () => {
      jest
        .spyOn(discordApiService, 'executeBotRequest')
        .mockImplementation(async (url) => {
          if (url.startsWith('/guilds')) {
            throw new DiscordAPIError('', HttpStatus.FORBIDDEN);
          }
        });

      const { statusCode } = await app.inject({
        method: 'GET',
        url: `/discord-servers/${serverId}/feeds?offset=0&limit=10`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(HttpStatus.BAD_REQUEST);
    });

    it('returns 400 if limit is missing', async () => {
      const { statusCode } = await app.inject({
        method: 'GET',
        url: `/discord-servers/${serverId}/feeds?offset=0`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(400);
    });
    it('returns 400 if offset is missing', async () => {
      const { statusCode } = await app.inject({
        method: 'GET',
        url: `/discord-servers/${serverId}/feeds?limit=10`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(400);
    });
    it('returns 400 if offset is not a number', async () => {
      const { statusCode } = await app.inject({
        method: 'GET',
        url: `/discord-servers/${serverId}/feeds?limit=10&offset=foo`,
        ...standardRequestOptions,
      });

      expect(statusCode).toBe(400);
    });

    it('returns 401 if no access token set via header cookie', async () => {
      const { statusCode } = await app.inject({
        method: 'GET',
        url: `/discord-servers/${serverId}/feeds?offset=0&limit=10`,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('returns the correct response', async () => {
      await feedModel.insertMany([
        createTestFeed({
          guild: serverId,
        }),
        createTestFeed({
          guild: serverId,
        }),
      ]);

      const { statusCode, body } = await app.inject({
        method: 'GET',
        url: `/discord-servers/${serverId}/feeds?limit=10&offset=0`,
        ...standardRequestOptions,
      });

      const parsedBody = JSON.parse(body);
      expect(statusCode).toEqual(200);
      expect(parsedBody.results).toHaveLength(2);
      expect(parsedBody.total).toEqual(2);
    });
  });
});

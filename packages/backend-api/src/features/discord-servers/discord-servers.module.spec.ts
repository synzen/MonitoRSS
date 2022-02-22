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

describe('DiscordServersModule', () => {
  let app: NestFastifyApplication;
  let feedModel: FeedModel;
  let discordApiService: DiscordAPIService;

  beforeEach(async () => {
    const { uncompiledModule, init } = setupEndpointTests({
      imports: [DiscordServersModule, MongooseTestModule.forRoot()],
      providers: [
        {
          provide: DiscordAPIService,
          useValue: {
            executeBotRequest: jest.fn(),
          },
        },
      ],
    });

    uncompiledModule.overrideProvider(DiscordAPIService).useValue({
      executeBotRequest: jest.fn(),
    });

    ({ app } = await init());

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
      jest
        .spyOn(discordApiService, 'executeBotRequest')
        .mockImplementation(async (url) => {
          if (url.startsWith('/guilds')) {
            return {
              id: '1',
            };
          }
        });
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
      });

      expect(statusCode).toBe(HttpStatus.BAD_REQUEST);
    });

    it('returns 400 if limit is missing', async () => {
      const { statusCode } = await app.inject({
        method: 'GET',
        url: `/discord-servers/${serverId}/feeds?offset=0`,
      });

      expect(statusCode).toBe(400);
    });
    it('returns 400 if offset is missing', async () => {
      const { statusCode } = await app.inject({
        method: 'GET',
        url: `/discord-servers/${serverId}/feeds?limit=10`,
      });

      expect(statusCode).toBe(400);
    });
    it('returns 400 if offset is not a number', async () => {
      const { statusCode } = await app.inject({
        method: 'GET',
        url: `/discord-servers/${serverId}/feeds?limit=10&offset=foo`,
      });

      expect(statusCode).toBe(400);
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
      });

      const parsedBody = JSON.parse(body);
      expect(statusCode).toEqual(200);
      expect(parsedBody.results).toHaveLength(2);
      expect(parsedBody.total).toEqual(2);
    });
  });
});

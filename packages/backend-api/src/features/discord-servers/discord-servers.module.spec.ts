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

describe('DiscordServersModule', () => {
  let app: NestFastifyApplication;
  let feedModel: FeedModel;

  beforeEach(async () => {
    ({ app } = await setupEndpointTests({
      imports: [DiscordServersModule, MongooseTestModule.forRoot()],
    }));

    feedModel = app.get<FeedModel>(getModelToken(Feed.name));
  });

  afterEach(async () => {
    await teardownEndpointTests();
  });

  describe('GET /discord-servers/:serverId/feeds', () => {
    it('returns 400 if limit is missing', async () => {
      const { statusCode } = await app.inject({
        method: 'GET',
        url: '/discord-servers/server-1/feeds?offset=0',
      });

      expect(statusCode).toBe(400);
    });
    it('returns 400 if offset is missing', async () => {
      const { statusCode } = await app.inject({
        method: 'GET',
        url: '/discord-servers/server-1/feeds?limit=10',
      });

      expect(statusCode).toBe(400);
    });
    it('returns 400 if offset is not a number', async () => {
      const { statusCode } = await app.inject({
        method: 'GET',
        url: '/discord-servers/server-1/feeds?limit=10&offset=foo',
      });

      expect(statusCode).toBe(400);
    });
    it('returns the correct response', async () => {
      const serverId = '123';

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
      console.log(parsedBody);
      expect(statusCode).toEqual(200);
      expect(parsedBody.results).toHaveLength(2);
      expect(parsedBody.total).toEqual(2);
    });
  });
});

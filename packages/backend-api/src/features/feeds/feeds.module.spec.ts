import { NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  setupEndpointTests,
  teardownEndpointTests,
} from '../../utils/endpoint-tests';
import { MongooseTestModule } from '../../utils/mongoose-test.module';
import nock from 'nock';
import { HttpStatus } from '@nestjs/common';
import { Session } from '../../common/types/Session';
import { FeedsModule } from './feeds.module';
import { Types } from 'mongoose';
import { DISCORD_API_BASE_URL } from '../../constants/discord';
import { PartialUserGuild } from '../discord-users/types/PartialUserGuild.type';
import { getModelToken } from '@nestjs/mongoose';
import { Feed, FeedModel } from './entities/Feed.entity';
import { createTestFeed } from '../../test/data/feeds.test-data';
import path from 'path';

describe('FeedsModule', () => {
  let app: NestFastifyApplication;
  let feedModel: FeedModel;
  let setAccessToken: (accessToken: Session['accessToken']) => Promise<string>;
  const standardRequestOptions = {
    headers: {
      cookie: '',
    },
  };
  const feedId = new Types.ObjectId().toHexString();
  const guildId = 'guild-id';

  beforeEach(async () => {
    const { init } = setupEndpointTests({
      imports: [FeedsModule, MongooseTestModule.forRoot()],
    });

    ({ app, setAccessToken } = await init());

    // To do - set up an endpoint to use the session middleware, set the session, and then run tests

    standardRequestOptions.headers.cookie = await setAccessToken({
      access_token: 'accessToken',
    } as Session['accessToken']);

    feedModel = app.get<FeedModel>(getModelToken(Feed.name));
  });

  afterEach(async () => {
    nock.cleanAll();
    await teardownEndpointTests();
  });

  const mockServers: PartialUserGuild[] = [
    {
      id: guildId,
      name: 'Test Guild',
      owner: true,
      permissions: 0,
    },
  ];

  const mockGetMeServers = (overrideServers?: PartialUserGuild[]) => {
    nock(DISCORD_API_BASE_URL)
      .get(`/users/@me/guilds`)
      .reply(200, overrideServers || mockServers);
  };

  describe('GET /feeds/:feedId', () => {
    it('returns 401 if not logged in with discord', async () => {
      mockGetMeServers();

      const { statusCode } = await app.inject({
        method: 'GET',
        url: `/feeds/${feedId}`,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('returns 403 if use does not have permission of guild of feed', async () => {
      const createdFeed = await feedModel.create(
        createTestFeed({
          guild: guildId,
        }),
      );

      mockGetMeServers([
        {
          id: createdFeed.guild + '1',
          name: 'Test Guild 3',
          owner: true,
          permissions: 0,
        },
      ]);

      const { statusCode } = await app.inject({
        method: 'GET',
        url: `/feeds/${createdFeed._id}`,
        ...standardRequestOptions,
      });

      expect(statusCode).toEqual(HttpStatus.FORBIDDEN);
    });

    it('returns 404 if the feed does not exist', async () => {
      mockGetMeServers();

      const { statusCode } = await app.inject({
        method: 'GET',
        url: `/feeds/${new Types.ObjectId()}`,
        ...standardRequestOptions,
      });

      expect(statusCode).toEqual(HttpStatus.NOT_FOUND);
    });

    it('returns the feed', async () => {
      mockGetMeServers();

      const feed = createTestFeed({
        guild: guildId,
      });

      await feedModel.create(feed);

      const { statusCode, body } = await app.inject({
        method: 'GET',
        url: `/feeds/${feed._id}`,
        ...standardRequestOptions,
      });

      const parsedBody = JSON.parse(body);
      expect(statusCode).toEqual(HttpStatus.OK);
      expect(parsedBody).toEqual({
        result: expect.any(Object),
      });
    });
  });

  describe('GET /feeds/:feedId/refresh', () => {
    it('returns 401 if not logged in with discord', async () => {
      mockGetMeServers();

      const { statusCode } = await app.inject({
        method: 'GET',
        url: `/feeds/${feedId}/refresh`,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('returns 403 if use does not have permission of guild of feed', async () => {
      const createdFeed = await feedModel.create(
        createTestFeed({
          guild: guildId,
        }),
      );

      mockGetMeServers([
        {
          id: createdFeed.guild + '1',
          name: 'Test Guild 3',
          owner: true,
          permissions: 0,
        },
      ]);

      const { statusCode } = await app.inject({
        method: 'GET',
        url: `/feeds/${createdFeed._id}/refresh`,
        ...standardRequestOptions,
      });

      expect(statusCode).toEqual(HttpStatus.FORBIDDEN);
    });

    it('returns 404 if the feed does not exist', async () => {
      mockGetMeServers();

      const { statusCode } = await app.inject({
        method: 'GET',
        url: `/feeds/${new Types.ObjectId()}/refresh`,
        ...standardRequestOptions,
      });

      expect(statusCode).toEqual(HttpStatus.NOT_FOUND);
    });

    it('returns the feed', async () => {
      mockGetMeServers();

      const feed = createTestFeed({
        guild: guildId,
      });

      await feedModel.create(feed);

      const { statusCode, body } = await app.inject({
        method: 'GET',
        url: `/feeds/${feed._id}/refresh`,
        ...standardRequestOptions,
      });

      const parsedBody = JSON.parse(body);
      expect(statusCode).toEqual(HttpStatus.OK);
      expect(parsedBody).toEqual({
        result: expect.any(Object),
      });
    });
  });

  describe('PATCH /feeds/:feedId', () => {
    it('returns 401 if not logged in with discord', async () => {
      mockGetMeServers();

      const { statusCode } = await app.inject({
        method: 'PATCH',
        url: `/feeds/${feedId}`,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('returns 403 if use does not have permission of guild of feed', async () => {
      const createdFeed = await feedModel.create(
        createTestFeed({
          guild: guildId,
        }),
      );

      mockGetMeServers([
        {
          id: createdFeed.guild + '1',
          name: 'Test Guild 3',
          owner: true,
          permissions: 0,
        },
      ]);

      const { statusCode } = await app.inject({
        method: 'PATCH',
        url: `/feeds/${createdFeed._id}`,
        ...standardRequestOptions,
      });

      expect(statusCode).toEqual(HttpStatus.FORBIDDEN);
    });

    it('updates and returns the updated feed', async () => {
      mockGetMeServers();

      const feed = createTestFeed({
        guild: guildId,
      });

      await feedModel.create(feed);

      const payload = {
        text: 'Hello world',
      };

      const { statusCode, body } = await app.inject({
        method: 'PATCH',
        url: `/feeds/${feed._id}`,
        payload,
        ...standardRequestOptions,
      });

      const parsedBody = JSON.parse(body);
      expect(statusCode).toEqual(HttpStatus.OK);
      expect(parsedBody).toEqual(
        expect.objectContaining({
          result: expect.objectContaining({
            text: payload.text,
          }),
        }),
      );
    });
  });

  describe('GET /feeds/:feedId/articles', () => {
    const feedUrl = 'https://rss-feed.com/feed.xml';

    beforeEach(() => {
      const url = new URL(feedUrl);
      const feedFilePath = path.join(
        __dirname,
        '..',
        '..',
        'test',
        'data',
        'feed.xml',
      );

      nock(url.origin).get(url.pathname).replyWithFile(200, feedFilePath, {
        'Content-Type': 'application/xml',
      });
    });
    it('returns 401 if not logged in with discord', async () => {
      mockGetMeServers();

      const { statusCode } = await app.inject({
        method: 'GET',
        url: `/feeds/${feedId}/articles`,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('returns 403 if use does not have permission of guild of feed', async () => {
      const createdFeed = await feedModel.create(
        createTestFeed({
          guild: guildId,
          url: feedUrl,
        }),
      );

      mockGetMeServers([
        {
          id: createdFeed.guild + '1',
          name: 'Test Guild 3',
          owner: true,
          permissions: 0,
        },
      ]);

      const { statusCode } = await app.inject({
        method: 'GET',
        url: `/feeds/${createdFeed._id}/articles`,
        ...standardRequestOptions,
      });

      expect(statusCode).toEqual(HttpStatus.FORBIDDEN);
    });

    it('returns the feed articles', async () => {
      const createdFeed = await feedModel.create(
        createTestFeed({
          guild: guildId,
          url: feedUrl,
        }),
      );

      mockGetMeServers();

      const { statusCode, body } = await app.inject({
        method: 'GET',
        url: `/feeds/${createdFeed._id}/articles`,
        ...standardRequestOptions,
      });

      expect(statusCode).toEqual(HttpStatus.OK);
      const parsedBody = JSON.parse(body);

      const articles = parsedBody.result;

      for (let i = 0; i < articles.length; i++) {
        expect(articles[i]).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            title: expect.any(String),
            placeholders: expect.objectContaining({
              public: expect.any(Array),
              private: expect.any(Array),
              raw: expect.any(Array),
              regex: expect.any(Array),
            }),
          }),
        );
      }
    });
  });
});

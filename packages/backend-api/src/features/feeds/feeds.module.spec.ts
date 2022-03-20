import { NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  setupEndpointTests,
  teardownEndpointTests,
} from '../../utils/endpoint-tests';
import { MongooseTestModule } from '../../utils/mongoose-test.module';
import nock from 'nock';
import { CACHE_MANAGER, HttpStatus } from '@nestjs/common';
import { Session } from '../../common/types/Session';
import { FeedsModule } from './feeds.module';
import { Types } from 'mongoose';
import { DISCORD_API_BASE_URL } from '../../constants/discord';
import { PartialUserGuild } from '../discord-users/types/PartialUserGuild.type';
import { getModelToken } from '@nestjs/mongoose';
import { Feed, FeedModel } from './entities/feed.entity';
import { createTestFeed } from '../../test/data/feeds.test-data';
import path from 'path';
import {
  Supporter,
  SupporterModel,
} from '../supporters/entities/supporter.entity';
import { Cache } from 'cache-manager';

import { ConfigService } from '@nestjs/config';
import { URL } from 'url';

describe('FeedsModule', () => {
  let app: NestFastifyApplication;
  let feedModel: FeedModel;
  let supporterModel: SupporterModel;
  let configService: ConfigService;
  let setAccessToken: (accessToken: Session['accessToken']) => Promise<string>;
  const standardRequestOptions = {
    headers: {
      cookie: '',
    },
  };
  const feedId = new Types.ObjectId().toHexString();
  const guildId = 'guild-id';

  beforeAll(async () => {
    const { init } = setupEndpointTests({
      imports: [FeedsModule, MongooseTestModule.forRoot()],
    });

    ({ app, setAccessToken } = await init());

    standardRequestOptions.headers.cookie = await setAccessToken({
      access_token: 'accessToken',
    } as Session['accessToken']);

    feedModel = app.get<FeedModel>(getModelToken(Feed.name));
    supporterModel = app.get<SupporterModel>(getModelToken(Supporter.name));
    configService = app.get<ConfigService>(ConfigService);
  });

  afterEach(async () => {
    nock.cleanAll();
    await feedModel.deleteMany({});
    await supporterModel.deleteMany({});

    const cacheManager = app.get<Cache>(CACHE_MANAGER);
    cacheManager.reset();
  });

  afterAll(async () => {
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
        title: 'newtitle',
        text: 'Hello world',
        checkTitles: true,
        checkDates: true,
        imgPreviews: true,
        imgLinksExistence: true,
        formatTables: true,
        splitMessage: true,
        filters: [
          {
            category: 'description',
            value: 'desc',
          },
          {
            category: 'title',
            value: 'title1',
          },
          {
            category: 'title',
            value: 'title2',
          },
        ],
      };

      const { statusCode, body } = await app.inject({
        method: 'PATCH',
        url: `/feeds/${feed._id}`,
        payload,
        ...standardRequestOptions,
      });

      const parsedBody = JSON.parse(body);
      expect(statusCode).toEqual(HttpStatus.OK);
      expect(parsedBody.result.text).toEqual(payload.text);
      expect(parsedBody.result.filters).toEqual(
        expect.arrayContaining(payload.filters),
      );
    });

    it.skip('returns 400 if channel that is being updated is not found', async () => {
      const channelId = 'channel-id';
      mockGetMeServers();

      const feed = createTestFeed({
        guild: guildId,
      });

      await feedModel.create(feed);

      jest.spyOn(console, 'error').mockImplementation();

      nock(DISCORD_API_BASE_URL)
        .get(`/channels/${channelId}`)
        .reply(404, { message: 'mock GET channel failure' });
      nock(DISCORD_API_BASE_URL)
        .get(
          `/guilds/${guildId}/members/${configService.get('discordClientId')}`,
        )
        .reply(200, { id: 'member-id' });

      const payload = {
        channelId,
      };

      const { statusCode } = await app.inject({
        method: 'PATCH',
        url: `/feeds/${feed._id}`,
        payload,
        ...standardRequestOptions,
      });

      expect(statusCode).toEqual(HttpStatus.BAD_REQUEST);
    });

    it('updates webhooks correctly', async () => {
      mockGetMeServers();
      const webhookId = 'webhook-id';

      const feed = createTestFeed({
        guild: guildId,
        webhook: undefined,
      });

      await supporterModel.create({
        guilds: [guildId],
        _id: 'discord-user-id',
        webhook: true,
      });

      await feedModel.create(feed);

      const payload = {
        webhookId,
      };

      nock(DISCORD_API_BASE_URL)
        .get(`/webhooks/${webhookId}`)
        .reply(200, { id: webhookId });

      const { statusCode, body } = await app.inject({
        method: 'PATCH',
        url: `/feeds/${feed._id}`,
        payload,
        ...standardRequestOptions,
      });

      const parsedBody = JSON.parse(body);
      expect(statusCode).toEqual(HttpStatus.OK);
      expect(parsedBody.result.webhook).toEqual({
        id: webhookId,
      });
    });
  });

  it('throws 400 if server has no access to webhooks (server has no supporter)', async () => {
    mockGetMeServers();
    const webhookId = 'webhook-id';

    const feed = createTestFeed({
      guild: guildId,
      webhook: undefined,
    });

    await feedModel.create(feed);

    const payload = {
      webhookId,
    };

    const { statusCode } = await app.inject({
      method: 'PATCH',
      url: `/feeds/${feed._id}`,
      payload,
      ...standardRequestOptions,
    });

    expect(statusCode).toEqual(HttpStatus.BAD_REQUEST);
  });

  it('returns 400 if webhook was not found by Discord', async () => {
    mockGetMeServers();
    const webhookId = 'webhook-id';

    const feed = createTestFeed({
      guild: guildId,
      webhook: undefined,
    });

    await supporterModel.create({
      guilds: [guildId],
      _id: 'discord-user-id',
      webhook: true,
    });

    await feedModel.create(feed);

    const payload = {
      webhookId,
    };

    nock(DISCORD_API_BASE_URL)
      .get(`/webhooks/${webhookId}`)
      .reply(404, { message: 'Webhook not found' });

    const { statusCode } = await app.inject({
      method: 'PATCH',
      url: `/feeds/${feed._id}`,
      payload,
      ...standardRequestOptions,
    });

    expect(statusCode).toEqual(HttpStatus.BAD_REQUEST);
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

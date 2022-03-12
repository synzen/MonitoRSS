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
import { Feed, FeedModel } from './entities/Feed.entity';
import { createTestFeed } from '../../test/data/feeds.test-data';
import {
  Supporter,
  SupporterModel,
} from '../supporters/entities/supporter.entity';
import { Cache } from 'cache-manager';
import {
  FeedSubscriber,
  FeedSubscriberModel,
  FeedSubscriberType,
} from './entities/feed-subscriber.entity';
import { createTestFeedSubscriber } from '../../test/data/subscriber.test-data';
import { CreateFeedSubscriberInputDto } from './dto/CreateFeedSubscriberInput.dto';

describe('FeedSubscribersModule', () => {
  let app: NestFastifyApplication;
  let feedModel: FeedModel;
  let supporterModel: SupporterModel;
  let feedSubscriberModel: FeedSubscriberModel;
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
    feedSubscriberModel = app.get<FeedSubscriberModel>(
      getModelToken(FeedSubscriber.name),
    );
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

  describe('GET /feeds/:feedId/subscribers', () => {
    it('returns 401 if not logged in with discord', async () => {
      mockGetMeServers();

      const { statusCode } = await app.inject({
        method: 'GET',
        url: `/feeds/${feedId}/subscribers`,
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
        url: `/feeds/${createdFeed._id}/subscribers`,
        ...standardRequestOptions,
      });

      expect(statusCode).toEqual(HttpStatus.FORBIDDEN);
    });

    it('returns 404 if the feed does not exist', async () => {
      mockGetMeServers();

      const { statusCode } = await app.inject({
        method: 'GET',
        url: `/feeds/${new Types.ObjectId()}/subscribers`,
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

      const subscriber = createTestFeedSubscriber({
        feed: feed._id,
      });

      await feedSubscriberModel.create(subscriber);

      const { statusCode, body } = await app.inject({
        method: 'GET',
        url: `/feeds/${feed._id}/subscribers`,
        ...standardRequestOptions,
      });

      const parsedBody = JSON.parse(body);
      expect(statusCode).toEqual(HttpStatus.OK);
      expect(parsedBody).toEqual({
        results: expect.any(Array),
        total: expect.any(Number),
      });
    });
  });

  describe('POST /feeds/:feedId/subscribers', () => {
    const validPayload: CreateFeedSubscriberInputDto = {
      discordId: 'discord-role-id',
      type: FeedSubscriberType.ROLE,
    };

    it('returns 401 if not logged in with discord', async () => {
      mockGetMeServers();

      const { statusCode } = await app.inject({
        method: 'POST',
        url: `/feeds/${feedId}/subscribers`,
        payload: validPayload,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('returns 403 if user does not have permission of guild of feed', async () => {
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
        method: 'POST',
        url: `/feeds/${createdFeed._id}/subscribers`,
        payload: validPayload,
        ...standardRequestOptions,
      });

      expect(statusCode).toEqual(HttpStatus.FORBIDDEN);
    });

    it('returns 404 if the feed does not exist', async () => {
      mockGetMeServers();

      const { statusCode } = await app.inject({
        method: 'POST',
        url: `/feeds/${new Types.ObjectId()}/subscribers`,
        payload: validPayload,
        ...standardRequestOptions,
      });

      expect(statusCode).toEqual(HttpStatus.NOT_FOUND);
    });

    it('returns the created subscriber', async () => {
      mockGetMeServers();

      const feed = createTestFeed({
        guild: guildId,
      });

      await feedModel.create(feed);

      const subscriber = createTestFeedSubscriber({
        feed: feed._id,
      });

      await feedSubscriberModel.create(subscriber);

      const { statusCode, body } = await app.inject({
        method: 'POST',
        url: `/feeds/${feed._id}/subscribers`,
        payload: validPayload,
        ...standardRequestOptions,
      });

      const parsedBody = JSON.parse(body);
      expect(statusCode).toEqual(HttpStatus.CREATED);
      expect(parsedBody).toEqual({
        result: expect.objectContaining({
          id: validPayload.discordId,
          type: validPayload.type,
        }),
      });
    });
  });
});

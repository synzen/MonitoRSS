import { NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  setupEndpointTests,
  teardownEndpointTests,
} from '../../utils/endpoint-tests';
import { MongooseTestModule } from '../../utils/mongoose-test.module';
import nock from 'nock';
import { CACHE_MANAGER, HttpStatus } from '@nestjs/common';
import { DISCORD_API_BASE_URL } from '../../constants/discord';
import { Session } from '../../common/types/Session';
import { DiscordUserModule } from './discord-users.module';
import { DiscordUser } from './types/DiscordUser.type';
import { PartialUserGuild } from './types/PartialUserGuild.type';
import { createTestSupporter } from '../../test/data/supporters.test-data';
import dayjs from 'dayjs';
import {
  Supporter,
  SupporterModel,
} from '../supporters/entities/supporter.entity';
import { getModelToken } from '@nestjs/mongoose';
import { Cache } from 'cache-manager';

describe('DiscordServersModule', () => {
  let app: NestFastifyApplication;
  let supporterModel: SupporterModel;
  let setAccessToken: (accessToken: Session['accessToken']) => Promise<string>;
  const standardRequestOptions = {
    headers: {
      cookie: '',
    },
  };
  const mockUser: DiscordUser = {
    id: '12345',
    username: 'Test User',
    discriminator: '1234',
  };

  beforeAll(async () => {
    const { init } = setupEndpointTests({
      imports: [DiscordUserModule, MongooseTestModule.forRoot()],
    });

    ({ app, setAccessToken } = await init());

    // To do - set up an endpoint to use the session middleware, set the session, and then run tests

    standardRequestOptions.headers.cookie = await setAccessToken({
      access_token: 'accessToken',
      discord: {
        id: mockUser.id,
      },
    } as Session['accessToken']);

    supporterModel = app.get<SupporterModel>(getModelToken(Supporter.name));
  });

  afterEach(async () => {
    nock.cleanAll();
    await supporterModel.deleteMany();

    const cacheManager = app.get<Cache>(CACHE_MANAGER);
    cacheManager.reset();
  });

  afterAll(async () => {
    await teardownEndpointTests();
  });

  const mockGetMe = (user?: Partial<DiscordUser>) => {
    nock(DISCORD_API_BASE_URL)
      .get(`/users/@me`)
      .reply(200, {
        ...mockUser,
        ...user,
      })
      .persist();
  };

  describe('GET /discord-users/@me', () => {
    it('returns 401 if not logged in with discord', async () => {
      mockGetMe();

      const { statusCode } = await app.inject({
        method: 'GET',
        url: `/discord-users/@me`,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('returns user with no supporter details', async () => {
      const mockUser: DiscordUser = {
        id: '1',
        username: 'username',
        discriminator: '1234',
        avatar: '123345',
      };

      mockGetMe(mockUser);

      const { statusCode, body } = await app.inject({
        method: 'GET',
        url: `/discord-users/@me`,
        ...standardRequestOptions,
      });

      const parsedBody = JSON.parse(body);
      expect(statusCode).toEqual(200);
      expect(parsedBody).toEqual({
        id: mockUser.id,
        username: mockUser.username,
        iconUrl: expect.any(String),
      });
    });

    it('returns user with supporter details', async () => {
      const mockUser: DiscordUser = {
        id: '1',
        username: 'username',
        discriminator: '1234',
        avatar: '123345',
      };

      mockGetMe(mockUser);

      const supporter = createTestSupporter({
        _id: mockUser.id,
        expireAt: dayjs().add(2, 'day').toDate(),
        maxGuilds: 10,
        maxFeeds: 11,
        guilds: ['1', '2'],
      });

      await supporterModel.create(supporter);

      const { statusCode, body } = await app.inject({
        method: 'GET',
        url: `/discord-users/@me`,
        ...standardRequestOptions,
      });

      const parsedBody = JSON.parse(body);
      expect(statusCode).toEqual(200);
      expect(parsedBody).toEqual({
        id: mockUser.id,
        username: mockUser.username,
        iconUrl: expect.any(String),
        supporter: {
          guilds: supporter.guilds,
          maxFeeds: supporter.maxFeeds,
          maxGuilds: supporter.maxGuilds,
          expireAt: supporter.expireAt?.toISOString(),
        },
      });
    });
  });

  describe('PATCH /discord-users/@me/supporter', () => {
    it('returns 401 if not logged in with discord', async () => {
      mockGetMe();

      const { statusCode } = await app.inject({
        method: 'PATCH',
        url: `/discord-users/@me/supporter`,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('returns 403 if user is not a supporter', async () => {
      mockGetMe();
      // User has no "supporter" document
      const payload = {
        guildIds: ['1', '2', '3'],
      };

      const { statusCode } = await app.inject({
        method: 'PATCH',
        url: `/discord-users/@me/supporter`,
        payload,
        ...standardRequestOptions,
      });

      expect(statusCode).toEqual(HttpStatus.FORBIDDEN);
    });

    it('returns 204 if valid supporter', async () => {
      mockGetMe(mockUser);

      const supporter = createTestSupporter({
        _id: mockUser.id,
        expireAt: dayjs().add(2, 'day').toDate(),
        maxGuilds: 10,
        maxFeeds: 11,
        guilds: ['1', '2'],
      });

      await supporterModel.create(supporter);

      const payload = {
        guildIds: ['1', '2', '3'],
      };

      const result = await app.inject({
        method: 'PATCH',
        url: `/discord-users/@me/supporter`,
        payload,
        ...standardRequestOptions,
      });

      expect(result.statusCode).toEqual(HttpStatus.NO_CONTENT);
    });

    it('ignores empty strings in guild ids', async () => {
      mockGetMe(mockUser);

      const supporter = createTestSupporter({
        _id: mockUser.id,
        expireAt: dayjs().add(2, 'day').toDate(),
        maxGuilds: 10,
        maxFeeds: 11,
        guilds: ['1', '2'],
      });

      await supporterModel.create(supporter);

      const payload = {
        guildIds: ['1', '', '3', ''],
      };

      const result = await app.inject({
        method: 'PATCH',
        url: `/discord-users/@me/supporter`,
        payload,
        ...standardRequestOptions,
      });

      expect(result.statusCode).toEqual(HttpStatus.NO_CONTENT);

      const foundSupporter = await supporterModel
        .findOne({
          _id: mockUser.id,
        })
        .lean();

      expect(foundSupporter?.guilds).toEqual([
        payload.guildIds[0],
        payload.guildIds[2],
      ]);
    });
  });

  describe('GET /users/@me/servers', () => {
    const mockServers: PartialUserGuild[] = [
      {
        id: '123',
        name: 'Test Guild',
        owner: true,
        permissions: 0,
      },
      {
        id: '456',
        name: 'Test Guild 2',
        owner: true,
        permissions: 0,
      },
    ];

    const mockGetMeServers = (overrideServers?: PartialUserGuild[]) => {
      nock(DISCORD_API_BASE_URL)
        .get(`/users/@me/guilds`)
        .reply(200, overrideServers || mockServers);
    };

    it('returns 401 if not logged in with discord', async () => {
      mockGetMeServers();

      const { statusCode } = await app.inject({
        method: 'GET',
        url: `/discord-users/@me/servers`,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it("returns the user's servers", async () => {
      mockGetMeServers();

      const { statusCode, body } = await app.inject({
        method: 'GET',
        url: `/discord-users/@me/servers`,
        ...standardRequestOptions,
      });

      const parsedBody = JSON.parse(body);
      expect(statusCode).toEqual(200);
      expect(parsedBody).toEqual({
        results: mockServers.map((server) => ({
          id: server.id,
          name: server.name,
          iconUrl: expect.any(String),
          benefits: {
            maxFeeds: expect.any(Number),
            webhooks: expect.any(Boolean),
          },
        })),
        total: mockServers.length,
      });
    });

    it('does not return servers the user does not have permission in', async () => {
      mockGetMeServers([
        {
          id: '789',
          name: 'Test Guild 3',
          owner: false,
          permissions: 0,
        },
      ]);

      const { statusCode, body } = await app.inject({
        method: 'GET',
        url: `/discord-users/@me/servers`,
        ...standardRequestOptions,
      });

      const parsedBody = JSON.parse(body);
      expect(statusCode).toEqual(200);
      expect(parsedBody).toEqual({
        results: [],
        total: 0,
      });
    });
  });
});

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
import { DiscordUserModule } from './discord-users.module';
import { DiscordUser } from './types/DiscordUser.type';
import { PartialUserGuild } from './types/PartialUserGuild.type';

describe('DiscordServersModule', () => {
  let app: NestFastifyApplication;
  let setAccessToken: (accessToken: Session['accessToken']) => Promise<string>;
  const standardRequestOptions = {
    headers: {
      cookie: '',
    },
  };

  beforeEach(async () => {
    const { init } = setupEndpointTests({
      imports: [DiscordUserModule, MongooseTestModule.forRoot()],
    });

    ({ app, setAccessToken } = await init());

    // To do - set up an endpoint to use the session middleware, set the session, and then run tests

    standardRequestOptions.headers.cookie = await setAccessToken({
      access_token: 'accessToken',
    } as Session['accessToken']);
  });

  afterEach(async () => {
    nock.cleanAll();
    await teardownEndpointTests();
  });

  describe('GET /discord-users/@me', () => {
    const mockGetMe = (user?: Partial<DiscordUser>) => {
      const mockUserResponse: DiscordUser = {
        id: '12345',
        username: 'Test User',
        discriminator: '1234',
        ...user,
      };

      nock(DISCORD_API_BASE_URL).get(`/users/@me`).reply(200, mockUserResponse);
    };

    it('returns 401 if not logged in with discord', async () => {
      mockGetMe();

      const { statusCode } = await app.inject({
        method: 'GET',
        url: `/discord-users/@me`,
      });

      expect(statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('returns the user', async () => {
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

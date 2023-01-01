// eslint-disable-next-line import/no-extraneous-dependencies
import { rest } from 'msw';
import { GetDiscordBotOutput, GetDiscordMeOutput } from '@/features/discordUser';
import { GetServersOutput } from '../features/discordServers/api/getServer';
import {
  CloneFeedOutput,
  CreateFeedSubscriberOutput,
  CreateUserFeedOutput,
  FeedSummary,
  GetFeedArticlesOutput,
  GetFeedOutput,
  GetFeedsOutput,
  GetFeedSubscribersOutput,
  GetUserFeedArticlePropertiesOutput,
  GetUserFeedArticlesOutput,
  GetUserFeedOutput,
  GetUserFeedsOutput,
  UpdateFeedSubscriberOutput,
  UpdateUserFeedOutput,
  UserFeedArticleRequestStatus,
  UserFeedHealthStatus,
} from '../features/feed';
import mockDiscordServers from './data/discordServers';
import mockFeeds from './data/feed';
import mockFeedArticles from './data/feedArticles';
import mockDiscordUser from './data/discordUser';
import {
  GetServerChannelsOutput,
  GetServerRolesOutput,
  GetServerSettingsOutput,
  GetServerStatusOutput,
  UpdateServerSettingsOutput,
} from '@/features/discordServers';
import mockDiscordChannels from './data/discordChannels';
import mockDiscordRoles from './data/discordRoles';
import mockFeedSubscribers from './data/feedSubscribers';
import { GetDiscordWebhooksOutput } from '@/features/discordWebhooks';
import mockDiscordWebhooks from './data/discordWebhooks';
import { generateMockApiErrorResponse } from './generateMockApiErrorResponse';
import mockDiscordBot from './data/discordBot';
import {
  CreateDiscordChannelConnectionOutput,
  CreateDiscordChannelConnectionTestArticleOutput,
  CreateDiscordWebhookConnectionOutput,
  CreateDiscordWebhookConnectionTestArticleOutput,
  UpdateDiscordChannelConnectionOutput,
  UpdateDiscordWebhookConnectionOutput,
} from '../features/feedConnections';
import { mockFeedChannelConnections, mockFeedWebhookConnections } from './data/feedConnection';
import mockUserFeeds from './data/userFeeds';
import mockFeedSummaries from './data/feeds';
import { mockSendTestArticleResult } from './data/testArticleResult';
import { mockUserFeedArticles } from './data/userFeedArticles';
import { GetUserFeedRequestsOutput } from '../features/feed/api/getUserFeedRequests';
import { mockUserFeedRequests } from './data/userFeedRequests';

const handlers = [
  rest.get('/api/v1/discord-users/bot', (req, res, ctx) => res(
    ctx.json<GetDiscordBotOutput>({
      result: mockDiscordBot,
    }),
  )),
  rest.get('/api/v1/discord-users/@me', (req, res, ctx) => res(
    ctx.json<GetDiscordMeOutput>(mockDiscordUser),
  )),

  rest.patch('/api/v1/discord-users/@me/supporter', (req, res, ctx) => res(
    ctx.status(204),
  )),

  rest.get('/api/v1/discord-users/@me/servers', (req, res, ctx) => res(
    ctx.json<GetServersOutput>({
      total: mockDiscordServers.length,
      results: mockDiscordServers,
    }),
  )),

  rest.get('/api/v1/discord-servers/:serverId/status', (req, res, ctx) => res(
    ctx.json<GetServerStatusOutput>({
      result: {
        authorized: true,
      },
    }),
  )),

  rest.get('/api/v1/discord-servers/:serverId', (req, res, ctx) => res(
    ctx.json<GetServerSettingsOutput>({
      result: {
        profile: {
          dateFormat: 'YYYY-MM-DD',
          dateLanguage: 'en',
          timezone: 'UTC',
        },
      },
    }),
  )),

  rest.patch('/api/v1/discord-servers/:serverId', (req, res, ctx) => res(
    ctx.delay(1000),
    ctx.json<UpdateServerSettingsOutput>({
      result: {
        profile: {
          dateFormat: 'YYYY-MM-DD',
          dateLanguage: 'en',
          timezone: 'UTC',
        },
      },
    }),
  )),

  rest.get('/api/v1/discord-servers/:serverId/feeds', (req, res, ctx) => {
    const limit = Number(req.url.searchParams.get('limit') || '10');
    const offset = Number(req.url.searchParams.get('offset') || '0');
    const search = req.url.searchParams.get('search');

    const theseMockSummariesTotal = mockFeedSummaries.length * 5;
    const theseMockSummaries: FeedSummary[] = new Array(
      theseMockSummariesTotal,
    ).fill(0).map((_, i) => ({
      ...mockFeedSummaries[i % mockFeedSummaries.length],
      id: i.toString(),
    })).filter((feed) => (!search ? true : feed.title.toLowerCase()
      .includes(search) || feed.url.toLowerCase().includes(search)));

    const results = theseMockSummaries.slice(offset, offset + limit);

    return res(
      ctx.delay(700),
      ctx.json<GetFeedsOutput>({
        total: theseMockSummariesTotal,
        results,
      }),
    );
  }),

  rest.get('/api/v1/discord-servers/:serverId/channels', (req, res, ctx) => res(
    ctx.delay(1000),
    ctx.json<GetServerChannelsOutput>({
      total: mockDiscordChannels.length,
      results: mockDiscordChannels,
    }),
  )),

  rest.get('/api/v1/discord-servers/:serverId/roles', (req, res, ctx) => res(
    // ctx.delay(1000),
    ctx.json<GetServerRolesOutput>({
      total: mockDiscordRoles.length,
      results: mockDiscordRoles,
    }),
  )),

  rest.get('/api/v1/discord-webhooks', (req, res, ctx) => res(
    // ctx.status(403),
    // ctx.json(generateMockApiErrorResponse({
    //   code: 'WEBHOOKS_MANAGE_MISSING_PERMISSIONS',
    // })),
    ctx.json<GetDiscordWebhooksOutput>({
      results: mockDiscordWebhooks,
    }),
  )),

  rest.post('/api/v1/feeds', (req, res, ctx) => res(
    ctx.delay(1000),
    ctx.status(403),
    ctx.json(generateMockApiErrorResponse({
      code: 'WEBHOOKS_MANAGE_MISSING_PERMISSIONS',
    })),
  )),

  rest.get('/api/v1/user-feeds', (req, res, ctx) => res(
    ctx.delay(500),
    ctx.json<GetUserFeedsOutput>({
      results: mockUserFeeds,
      total: mockUserFeeds.length,
    }),
  )),

  rest.post('/api/v1/user-feeds', (req, res, ctx) => res(
    ctx.delay(500),
    ctx.json<CreateUserFeedOutput>({
      result: mockUserFeeds[0],
    }),
  )),

  rest.delete('/api/v1/user-feeds/:feedId', (req, res, ctx) => {
    const { feedId } = req.params;

    const index = mockUserFeeds.findIndex((feed) => feed.id === feedId);

    if (index === -1) {
      return res(
        ctx.status(404),
        ctx.json(generateMockApiErrorResponse({
          code: 'FEED_NOT_FOUND',
        })),
      );
    }

    mockUserFeeds.splice(index, 1);

    return res(
      ctx.delay(500),
      ctx.status(204),
    );
  }),

  rest.patch('/api/v1/user-feeds/:feedId', (req, res, ctx) => {
    const matchingUserFeed = mockUserFeeds.find((feed) => feed.id === req.params.feedId);

    if (!matchingUserFeed) {
      return res(
        ctx.status(404),
        ctx.json({}),
      );
    }

    return res(
      ctx.delay(500),
      ctx.json<UpdateUserFeedOutput>({
        result: matchingUserFeed,
      }),
    );
  }),

  rest.get('/api/v1/user-feeds/:feedId', (req, res, ctx) => {
    const { feedId } = req.params;
    const feed = mockUserFeeds.find((f) => f.id === feedId);

    if (!feed) {
      return res(
        ctx.status(404),
        ctx.json(generateMockApiErrorResponse({
          code: 'FEED_NOT_FOUND',
        })),
      );
    }

    return res(
      ctx.delay(500),
      ctx.json<GetUserFeedOutput>({
        result: feed,
      }),
    );
  }),

  rest.post('/api/v1/user-feeds/:feedId/get-articles', async (req, res, ctx) => {
    const { skip, limit } = await req.json();

    const useSkip = skip || 0;
    const useLimit = limit || 10;

    const articles = mockUserFeedArticles.slice(useSkip, useSkip + useLimit);

    return res(
      ctx.delay(500),
      ctx.json<GetUserFeedArticlesOutput>({
        result: {
          articles,
          totalArticles: mockUserFeedArticles.length,
          requestStatus: UserFeedArticleRequestStatus.Success,
          response: {
            statusCode: 403,
          },
          filterStatuses: mockUserFeedArticles.map((_, index) => ({ passed: index % 2 === 0 })),
          selectedProperties: ['id', 'title'],
        },
      }),
    );
  }),

  rest.get('/api/v1/user-feeds/:feedId/requests', async (req, res, ctx) => res(
    ctx.delay(500),
    ctx.json<GetUserFeedRequestsOutput>({
      result: {
        requests: mockUserFeedRequests,
        totalRequests: mockUserFeedRequests.length,
        nextRetryTimestamp: Math.floor(new Date(2020).getTime() / 1000),
      },
    }),
  )),

  rest.get('/api/v1/user-feeds/:feedId/article-properties', async (req, res, ctx) => res(
    ctx.delay(500),
    ctx.json<GetUserFeedArticlePropertiesOutput>({
      result: {
        requestStatus: UserFeedArticleRequestStatus.Success,
        properties: ['id', 'title'],
      },
    }),
  )),

  rest.get('/api/v1/user-feeds/:feedId/daily-limit', (req, res, ctx) => res(
    ctx.delay(500),
    ctx.json({
      result: {
        current: 100,
        max: 500,
      },
    }),
  )),

  rest.get('/api/v1/user-feeds/:feedId/retry', (req, res, ctx) => {
    const { feedId } = req.params as Record<string, unknown>;
    const feed = mockUserFeeds.find((f) => f.id === feedId);

    if (!feed) {
      return res(
        ctx.status(404),
        ctx.json(generateMockApiErrorResponse({
          code: 'FEED_NOT_FOUND',
        })),
      );
    }

    feed.disabledCode = undefined;
    feed.healthStatus = UserFeedHealthStatus.Ok;

    return res(
      ctx.delay(500),
      ctx.json<GetUserFeedOutput>({
        result: feed,
      }),
    );
  }),

  rest.get('/api/v1/feeds/:feedId', (req, res, ctx) => res(
    ctx.delay(500),
    ctx.json<GetFeedOutput>({
      result: mockFeeds[0],
    }),
  )),

  rest.get('/api/v1/feeds/:feedId', (req, res, ctx) => res(
    ctx.delay(500),
    ctx.json<GetFeedOutput>({
      result: mockFeeds[0],
    }),
  )),

  rest.delete('/api/v1/feeds/:feedId', (req, res, ctx) => res(
    ctx.delay(500),
    ctx.status(204),
  )),

  rest.post('/api/v1/feeds/:feedId/clone', (req, res, ctx) => res(
    ctx.delay(500),
    ctx.json<CloneFeedOutput>({
      results: mockFeeds,
    }),
  )),

  rest.post('/api/v1/user-feeds/:feedId/connections/discord-channels', (req, res, ctx) => res(
    ctx.delay(500),
    ctx.json<CreateDiscordChannelConnectionOutput>({
      result: mockFeedChannelConnections[0],
    }),
  )),

  rest.post('/api/v1/user-feeds/:feedId/'
    + 'connections/discord-channels/:id/test', (req, res, ctx) => res(
    ctx.delay(500),
    ctx.json<CreateDiscordChannelConnectionTestArticleOutput>({
      result: mockSendTestArticleResult,
    }),
  )),

  rest.patch('/api/v1/user-feeds/:feedId/connections/discord-channels/:id', (req, res, ctx) => res(
    ctx.delay(500),
    ctx.json<UpdateDiscordChannelConnectionOutput>({
      result: mockFeedChannelConnections[0],
    }),
  )),

  rest.delete('/api/v1/user-feeds/:feedId/connections/discord-channels/:id', (req, res, ctx) => res(
    ctx.delay(500),
    ctx.status(204),
  )),

  rest.post('/api/v1/user-feeds/:feedId/connections/discord-webhooks', (req, res, ctx) => res(
    ctx.delay(500),
    ctx.json<CreateDiscordWebhookConnectionOutput>({
      result: mockFeedWebhookConnections[0],
    }),
  )),

  rest.post('/api/v1/user-feeds/:feedId/'
    + 'connections/discord-webhooks/:id/test', (req, res, ctx) => res(
    ctx.delay(500),
    ctx.json<CreateDiscordWebhookConnectionTestArticleOutput>({
      result: mockSendTestArticleResult,
    }),
  )),

  rest.patch('/api/v1/user-feeds/:feedId/connections/discord-webhooks/:id', (req, res, ctx) => {
    const matchingConnection = mockFeedWebhookConnections.find((c) => c.id === req.params.id);

    if (!matchingConnection) {
      return res(
        ctx.status(404),
        ctx.json({}),
      );
    }

    return res(
      ctx.delay(500),
      ctx.json<UpdateDiscordWebhookConnectionOutput>({
        result: matchingConnection,
      }),
    );
  }),

  rest.delete('/api/v1/user-feeds/:feedId/connections/discord-webhooks/:id', (req, res, ctx) => res(
    ctx.delay(500),
    ctx.status(204),
  )),

  rest.get('/api/v1/feeds/:feedId/subscribers', (req, res, ctx) => res(
    ctx.json<GetFeedSubscribersOutput>({
      results: mockFeedSubscribers,
      total: mockFeedSubscribers.length,
    }),
  )),

  rest.post('/api/v1/feeds/:feedId/subscribers', (req, res, ctx) => res(
    ctx.delay(500),
    ctx.json<CreateFeedSubscriberOutput>({
      result: {
        id: '3',
        discordId: mockDiscordRoles[2].id,
        feed: mockFeeds[0].id,
        filters: [],
        type: 'role',
      },
    }),
  )),

  rest.patch('/api/v1/feeds/:feedId/subscribers/:subscriberId', (req, res, ctx) => res(
    ctx.delay(500),
    ctx.json<UpdateFeedSubscriberOutput>({
      result: mockFeedSubscribers[0],
    }),
  )),

  rest.delete('/api/v1/feeds/:feedId/subscribers/:subscriberId', (req, res, ctx) => res(
    ctx.delay(500),
    ctx.status(204),
  )),

  rest.patch('/api/v1/feeds/:feedId', (req, res, ctx) => res(
    ctx.status(400),
    ctx.json(generateMockApiErrorResponse({
      code: 'WEBHOOK_INVALID',
    })),
    // ctx.json<UpdateFeedOutput>({
    //   result: mockFeeds[0],
    // }),
  )),

  rest.get('/api/v1/feeds/:feedId/articles', (req, res, ctx) => res(
    ctx.json<GetFeedArticlesOutput>({
      result: mockFeedArticles,
    }),
  )),

  rest.get('/api/v1/feeds/:feedId/refresh', (req, res, ctx) => res(
    ctx.status(200),
    ctx.json<GetFeedOutput>({
      result: mockFeeds[0],
    }),
  )),
];

export default handlers;

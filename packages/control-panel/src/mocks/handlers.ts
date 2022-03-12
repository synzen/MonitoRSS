// eslint-disable-next-line import/no-extraneous-dependencies
import { rest } from 'msw';
import { GetDiscordMeOutput } from '@/features/discordUser';
import { GetServersOutput } from '../features/discordServers/api/getServer';
import {
  FeedSummary,
  GetFeedArticlesOutput, GetFeedOutput, GetFeedsOutput, UpdateFeedOutput,
} from '../features/feed';
import mockDiscordServers from './data/discordServers';
import mockFeeds from './data/feed';
import mockFeedArticles from './data/feedArticles';
import mockFeedSummaries from './data/feeds';
import mockDiscordUser from './data/discordUser';
import { GetDiscordWebhooksOutput } from '@/features/discordWebhooks';
import mockDiscordWebhooks from './data/discordWebhooks';
import { GetServerChannelsOutput, GetServerRolesOutput } from '@/features/discordServers';
import mockDiscordChannels from './data/discordChannels';
import mockDiscordRoles from './data/discordRoles';

const handlers = [
  rest.get('/api/v1/discord-users/@me', (req, res, ctx) => res(
    ctx.status(200),
    ctx.json<GetDiscordMeOutput>(mockDiscordUser),
  )),

  rest.patch('/api/v1/discord-users/@me/supporter', (req, res, ctx) => res(
    ctx.delay(1000),
    ctx.status(204),
  )),

  rest.get('/api/v1/discord-users/@me/servers', (req, res, ctx) => res(
    ctx.json<GetServersOutput>({
      total: mockDiscordServers.length,
      results: mockDiscordServers,
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
    ctx.delay(1000),
    ctx.json<GetServerRolesOutput>({
      total: mockDiscordRoles.length,
      results: mockDiscordRoles,
    }),
  )),

  rest.get('/api/v1/discord-webhooks', (req, res, ctx) => res(
    ctx.json<GetDiscordWebhooksOutput>({
      results: mockDiscordWebhooks,
    }),
  )),

  rest.get('/api/v1/feeds/:feedId', (req, res, ctx) => res(
    // ctx.status(400),
    ctx.delay(500),
    ctx.json<GetFeedOutput>({
      result: mockFeeds[0],
    }),
  )),

  rest.patch('/api/v1/feeds/:feedId', (req, res, ctx) => res(
    ctx.json<UpdateFeedOutput>({
      result: mockFeeds[0],
    }),
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

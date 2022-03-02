// eslint-disable-next-line import/no-extraneous-dependencies
import { rest } from 'msw';
import { GetDiscordMeOutput } from '@/features/discordUser';
import { GetServersOutput } from '../features/discordServers/api/getServer';
import {
  GetFeedArticlesOutput, GetFeedOutput, GetFeedsOutput, UpdateFeedOutput,
} from '../features/feed';
import mockDiscordServers from './data/discordServers';
import mockFeeds from './data/feed';
import mockFeedArticles from './data/feedArticles';
import mockFeedSummaries from './data/feeds';
import mockDiscordUser from './data/discordUser';

const handlers = [
  rest.get('/api/v1/discord-users/@me', (req, res, ctx) => res(
    ctx.status(200),
    ctx.json<GetDiscordMeOutput>(mockDiscordUser),
  )),
  rest.get('/api/v1/discord-users/@me/servers', (req, res, ctx) => res(
    ctx.json<GetServersOutput>({
      total: mockDiscordServers.length,
      results: mockDiscordServers,
    }),
  )),

  rest.get('/api/v1/discord-servers/:serverId/feeds', (req, res, ctx) => res(
    ctx.json<GetFeedsOutput>({
      total: mockFeedSummaries.length,
      results: mockFeedSummaries,
    }),
  )),

  rest.get('/api/v1/feeds/:feedId', (req, res, ctx) => res(
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

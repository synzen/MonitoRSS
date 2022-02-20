// eslint-disable-next-line import/no-extraneous-dependencies
import { rest } from 'msw';
import { GetFeedOutput } from '../adapters/feeds/getFeed';
import { GetFeedArticlesOutput } from '../adapters/feeds/getFeedArticles';
import { GetFeedsOutput } from '../adapters/feeds/getFeeds';
import { GetServersOutput } from '../adapters/servers/getServer';
import mockDiscordServers from './data/discordServers';
import mockFeeds from './data/feed';
import mockFeedArticles from './data/feedArticles';
import mockFeedSummaries from './data/feeds';

const handlers = [
  rest.get('/api/v1/servers', (req, res, ctx) => res(
    ctx.status(200),
    ctx.json<GetServersOutput>({
      total: mockDiscordServers.length,
      results: mockDiscordServers,
    }),
  )),

  rest.get('/api/v1/servers/:serverId/feeds', (req, res, ctx) => res(
    ctx.status(200),
    ctx.json<GetFeedsOutput>({
      total: mockFeedSummaries.length,
      results: mockFeedSummaries,
    }),
  )),

  rest.get('/api/v1/servers/:serverId/feeds/:feedId', (req, res, ctx) => res(
    ctx.status(200),
    ctx.json<GetFeedOutput>({
      result: mockFeeds[0],
    }),
  )),

  rest.get('/api/v1/feeds/:feedId/articles', (req, res, ctx) => res(
    ctx.status(200),
    ctx.json<GetFeedArticlesOutput>({
      result: mockFeedArticles,
    }),
  )),
];

export default handlers;

// eslint-disable-next-line import/no-extraneous-dependencies
import { rest } from 'msw';
import { GetFeedsOutput } from '../adapters/feeds/getFeeds';
import { GetServersOutput } from '../adapters/servers/getServer';
import mockDiscordServers from './data/discordServers';
import mockFeeds from './data/feeds';

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
      total: mockFeeds.length,
      results: mockFeeds,
    }),
  )),
];

export default handlers;

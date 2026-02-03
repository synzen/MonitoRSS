import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  getServerHandler,
  getServerStatusHandler,
  getActiveThreadsHandler,
  getServerChannelsHandler,
  getServerRolesHandler,
} from "./discord-servers.handlers";
import {
  requireAuthHook,
  requireBotInServer,
  requireServerPermission,
} from "../../infra/auth";

interface ServerParams {
  serverId: string;
}

interface ActiveThreadsQuerystring {
  parentChannelId?: string;
}

interface ChannelsQuerystring {
  types?: string;
}

const extractServerId = (request: FastifyRequest) =>
  (request.params as ServerParams).serverId;

export async function discordServersRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get<{ Params: ServerParams }>("/:serverId", {
    preHandler: [
      requireAuthHook,
      requireBotInServer(extractServerId),
      requireServerPermission(extractServerId),
    ],
    handler: getServerHandler,
  });

  app.get<{ Params: ServerParams }>("/:serverId/status", {
    preHandler: [requireAuthHook, requireServerPermission(extractServerId)],
    handler: getServerStatusHandler,
  });

  app.get<{ Params: ServerParams; Querystring: ActiveThreadsQuerystring }>(
    "/:serverId/active-threads",
    {
      preHandler: [
        requireAuthHook,
        requireBotInServer(extractServerId),
        requireServerPermission(extractServerId),
      ],
      handler: getActiveThreadsHandler,
    },
  );

  app.get<{ Params: ServerParams; Querystring: ChannelsQuerystring }>(
    "/:serverId/channels",
    {
      preHandler: [requireAuthHook, requireServerPermission(extractServerId)],
      handler: getServerChannelsHandler,
    },
  );

  app.get<{ Params: ServerParams }>("/:serverId/roles", {
    preHandler: [
      requireAuthHook,
      requireBotInServer(extractServerId),
      requireServerPermission(extractServerId),
    ],
    handler: getServerRolesHandler,
  });
}

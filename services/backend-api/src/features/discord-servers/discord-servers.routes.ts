import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  getServerHandler,
  getServerStatusHandler,
  getActiveThreadsHandler,
  getServerChannelsHandler,
  getServerRolesHandler,
  getServerMembersHandler,
  getServerMemberHandler,
} from "./discord-servers.handlers";
import {
  requireAuthHook,
  requireBotInServer,
  requireServerPermission,
} from "../../infra/auth";
import {
  MembersQuerystringSchema,
  type ServerParams,
  type MemberParams,
  type ActiveThreadsQuerystring,
  type ChannelsQuerystring,
  type MembersQuerystring,
} from "./discord-servers.schemas";

const extractServerId = (request: FastifyRequest) =>
  (request.params as ServerParams).serverId;

export async function discordServersRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("onRequest", requireAuthHook);

  app.get<{ Params: ServerParams }>("/:serverId", {
    preHandler: [
      requireBotInServer(extractServerId),
      requireServerPermission(extractServerId),
    ],
    handler: getServerHandler,
  });

  app.get<{ Params: ServerParams }>("/:serverId/status", {
    preHandler: [requireServerPermission(extractServerId)],
    handler: getServerStatusHandler,
  });

  app.get<{ Params: ServerParams; Querystring: ActiveThreadsQuerystring }>(
    "/:serverId/active-threads",
    {
      preHandler: [
        requireBotInServer(extractServerId),
        requireServerPermission(extractServerId),
      ],
      handler: getActiveThreadsHandler,
    },
  );

  app.get<{ Params: ServerParams; Querystring: ChannelsQuerystring }>(
    "/:serverId/channels",
    {
      preHandler: [requireServerPermission(extractServerId)],
      handler: getServerChannelsHandler,
    },
  );

  app.get<{ Params: ServerParams }>("/:serverId/roles", {
    preHandler: [
      requireBotInServer(extractServerId),
      requireServerPermission(extractServerId),
    ],
    handler: getServerRolesHandler,
  });

  app.get<{ Params: ServerParams; Querystring: MembersQuerystring }>(
    "/:serverId/members",
    {
      preHandler: [
        requireBotInServer(extractServerId),
        requireServerPermission(extractServerId),
      ],
      schema: {
        querystring: MembersQuerystringSchema,
      },
      handler: getServerMembersHandler,
    },
  );

  app.get<{ Params: MemberParams }>("/:serverId/members/:memberId", {
    preHandler: [
      requireBotInServer(extractServerId),
      requireServerPermission(extractServerId),
    ],
    handler: getServerMemberHandler,
  });
}

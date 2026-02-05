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

interface ServerParams {
  serverId: string;
}

interface MemberParams {
  serverId: string;
  memberId: string;
}

interface ActiveThreadsQuerystring {
  parentChannelId?: string;
}

interface ChannelsQuerystring {
  types?: string;
}

interface MembersQuerystring {
  search: string;
  limit: number;
}

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
        querystring: {
          type: "object",
          required: ["search", "limit"],
          properties: {
            search: { type: "string", minLength: 1 },
            limit: { type: "integer", minimum: 1 },
          },
        },
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

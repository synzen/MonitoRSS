import type { FastifyInstance } from "fastify";
import { requireAuthHook } from "../../infra/auth";
import {
  CreateConnectionParamsSchema,
  CreateDiscordChannelConnectionBodySchema,
  type CreateConnectionParams,
  type CreateDiscordChannelConnectionBody,
} from "./feed-connections.schemas";
import { withExceptionFilter } from "../../shared/filters/exception-filter";
import { CREATE_CONNECTION_EXCEPTION_ERROR_CODES } from "./feed-connections.exception-codes";
import { createDiscordChannelConnectionHandler } from "./feed-connections.handlers";

export async function feedConnectionsRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("onRequest", requireAuthHook);

  app.post<{
    Params: CreateConnectionParams;
    Body: CreateDiscordChannelConnectionBody;
  }>("/discord-channels", {
    schema: {
      params: CreateConnectionParamsSchema,
      body: CreateDiscordChannelConnectionBodySchema,
    },
    handler: withExceptionFilter(
      CREATE_CONNECTION_EXCEPTION_ERROR_CODES,
      createDiscordChannelConnectionHandler,
    ),
  });
}

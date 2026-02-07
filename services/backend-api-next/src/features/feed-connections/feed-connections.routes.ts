import type { FastifyInstance } from "fastify";
import { requireAuthHook } from "../../infra/auth";
import {
  CreateConnectionParamsSchema,
  CreateDiscordChannelConnectionBodySchema,
  ConnectionActionParamsSchema,
  SendConnectionTestArticleBodySchema,
  type CreateConnectionParams,
  type CreateDiscordChannelConnectionBody,
  type ConnectionActionParams,
  type SendConnectionTestArticleBody,
} from "./feed-connections.schemas";
import { withExceptionFilter } from "../../shared/filters/exception-filter";
import {
  CREATE_CONNECTION_EXCEPTION_ERROR_CODES,
  SEND_TEST_ARTICLE_EXCEPTION_ERROR_CODES,
} from "./feed-connections.exception-codes";
import {
  createDiscordChannelConnectionHandler,
  sendTestArticleHandler,
} from "./feed-connections.handlers";

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

  app.post<{
    Params: ConnectionActionParams;
    Body: SendConnectionTestArticleBody;
  }>("/discord-channels/:connectionId/test", {
    schema: {
      params: ConnectionActionParamsSchema,
      body: SendConnectionTestArticleBodySchema,
    },
    handler: withExceptionFilter(
      SEND_TEST_ARTICLE_EXCEPTION_ERROR_CODES,
      sendTestArticleHandler,
    ),
  });
}

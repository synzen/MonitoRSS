import type { FastifyInstance } from "fastify";
import { requireAuthHook } from "../../infra/auth";
import {
  CreateConnectionParamsSchema,
  CreateDiscordChannelConnectionBodySchema,
  ConnectionActionParamsSchema,
  SendConnectionTestArticleBodySchema,
  CopyConnectionSettingsBodySchema,
  CloneConnectionBodySchema,
  CreatePreviewBodySchema,
  CreateTemplatePreviewBodySchema,
  type CreateConnectionParams,
  type CreateDiscordChannelConnectionBody,
  type ConnectionActionParams,
  type SendConnectionTestArticleBody,
  type CopyConnectionSettingsBody,
  type CloneConnectionBody,
  type CreatePreviewBody,
  type CreateTemplatePreviewBody,
} from "./feed-connections.schemas";
import { withExceptionFilter } from "../../shared/filters/exception-filter";
import {
  CREATE_CONNECTION_EXCEPTION_ERROR_CODES,
  SEND_TEST_ARTICLE_EXCEPTION_ERROR_CODES,
  COPY_CONNECTION_SETTINGS_EXCEPTION_ERROR_CODES,
  CREATE_PREVIEW_EXCEPTION_ERROR_CODES,
  CREATE_TEMPLATE_PREVIEW_EXCEPTION_ERROR_CODES,
} from "./feed-connections.exception-codes";
import {
  createDiscordChannelConnectionHandler,
  sendTestArticleHandler,
  copyConnectionSettingsHandler,
  cloneConnectionHandler,
  createPreviewHandler,
  createTemplatePreviewHandler,
} from "./feed-connections.handlers";

export async function feedConnectionsRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("onRequest", requireAuthHook);

  app.post<{
    Params: CreateConnectionParams;
    Body: CreateTemplatePreviewBody;
  }>("/template-preview", {
    schema: {
      params: CreateConnectionParamsSchema,
      body: CreateTemplatePreviewBodySchema,
    },
    handler: withExceptionFilter(
      CREATE_TEMPLATE_PREVIEW_EXCEPTION_ERROR_CODES,
      createTemplatePreviewHandler,
    ),
  });

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

  app.post<{
    Params: ConnectionActionParams;
    Body: CopyConnectionSettingsBody;
  }>("/discord-channels/:connectionId/copy-connection-settings", {
    schema: {
      params: ConnectionActionParamsSchema,
      body: CopyConnectionSettingsBodySchema,
    },
    handler: withExceptionFilter(
      COPY_CONNECTION_SETTINGS_EXCEPTION_ERROR_CODES,
      copyConnectionSettingsHandler,
    ),
  });

  app.post<{
    Params: ConnectionActionParams;
    Body: CloneConnectionBody;
  }>("/discord-channels/:connectionId/clone", {
    schema: {
      params: ConnectionActionParamsSchema,
      body: CloneConnectionBodySchema,
    },
    handler: withExceptionFilter(
      CREATE_CONNECTION_EXCEPTION_ERROR_CODES,
      cloneConnectionHandler,
    ),
  });

  app.post<{
    Params: ConnectionActionParams;
    Body: CreatePreviewBody;
  }>("/discord-channels/:connectionId/preview", {
    schema: {
      params: ConnectionActionParamsSchema,
      body: CreatePreviewBodySchema,
    },
    handler: withExceptionFilter(
      CREATE_PREVIEW_EXCEPTION_ERROR_CODES,
      createPreviewHandler,
    ),
  });
}

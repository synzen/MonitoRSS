/**
 * Fastify HTTP server setup (migrated from Bun.serve())
 */

import Fastify, { type FastifyInstance } from "fastify";
import type { DeliveryRecordStore } from "../stores/interfaces/delivery-record-store";
import type { DiscordRestClient } from "../delivery/mediums/discord/discord-rest-client";
import type { ArticleFieldStore } from "../articles/comparison";
import type { ResponseHashStore } from "../feeds/feed-event-handler";
import {
  handleFilterValidation,
  handleValidateDiscordPayload,
  handleDeliveryCount,
  handleDeliveryLogs,
  handleGetArticles,
  handlePreview,
  handleTest,
  handleDeliveryPreview,
} from "./handlers";
import {
  jsonResponse,
  handleError,
  toWebRequest,
  fromWebResponse,
  adaptHandler,
} from "./utils";

/**
 * Context for HTTP server with injected dependencies.
 */
export interface HttpServerContext {
  deliveryRecordStore: DeliveryRecordStore;
  discordClient: DiscordRestClient;
  /** Override the feed requests service host (for testing) */
  feedRequestsServiceHost: string;
  /** Article field store for delivery preview */
  articleFieldStore?: ArticleFieldStore;
  /** Response hash store for delivery preview (to check if feed content changed) */
  responseHashStore?: ResponseHashStore;
}

/**
 * Create the HTTP server with Fastify.
 */
export async function createHttpServer(
  context: HttpServerContext,
  port: number
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // Health endpoint (no auth required)
  app.get("/v1/user-feeds/health", async () => ({ status: "ok" }));

  // POST endpoints - use adaptHandler to wrap existing handlers
  app.post(
    "/v1/user-feeds/filter-validation",
    adaptHandler(handleFilterValidation)
  );

  app.post(
    "/v1/user-feeds/validate-discord-payload",
    adaptHandler(handleValidateDiscordPayload)
  );

  app.post(
    "/v1/user-feeds/get-articles",
    adaptHandler((req) => handleGetArticles(req, context.feedRequestsServiceHost))
  );

  app.post(
    "/v1/user-feeds/preview",
    adaptHandler((req) => handlePreview(req, context.feedRequestsServiceHost))
  );

  app.post(
    "/v1/user-feeds/test",
    adaptHandler((req) =>
      handleTest(req, context.discordClient, context.feedRequestsServiceHost)
    )
  );

  app.post(
    "/v1/user-feeds/delivery-preview",
    adaptHandler(async (req) => {
      if (!context.articleFieldStore) {
        return jsonResponse(
          { message: "Article field store not configured" },
          500
        );
      }
      if (!context.responseHashStore) {
        return jsonResponse(
          { message: "Response hash store not configured" },
          500
        );
      }
      return handleDeliveryPreview(
        req,
        context.feedRequestsServiceHost,
        context.articleFieldStore,
        context.deliveryRecordStore,
        context.responseHashStore
      );
    })
  );

  // GET endpoints with path params
  app.get<{ Params: { feedId: string } }>(
    "/v1/user-feeds/:feedId/delivery-count",
    async (request, reply) => {
      const webRequest = toWebRequest(request);
      const url = new URL(webRequest.url);
      const feedId = request.params.feedId;
      const response = await handleDeliveryCount(
        webRequest,
        url,
        feedId,
        context.deliveryRecordStore
      );
      await fromWebResponse(response, reply);
    }
  );

  app.get<{ Params: { feedId: string } }>(
    "/v1/user-feeds/:feedId/delivery-logs",
    async (request, reply) => {
      const webRequest = toWebRequest(request);
      const url = new URL(webRequest.url);
      const feedId = request.params.feedId;
      const response = await handleDeliveryLogs(
        webRequest,
        url,
        feedId,
        context.deliveryRecordStore
      );
      await fromWebResponse(response, reply);
    }
  );

  // Global error handler
  app.setErrorHandler(async (error, request, reply) => {
    const response = handleError(error);
    await fromWebResponse(response, reply);
  });

  // 404 handler
  app.setNotFoundHandler(async (request, reply) => {
    reply.status(404).send({ error: "Not Found" });
  });

  await app.listen({ port, host: "0.0.0.0" });
  return app;
}

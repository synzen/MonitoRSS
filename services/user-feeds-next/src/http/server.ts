/**
 * Bun.serve() HTTP server setup
 */

import type { Server } from "bun";
import type { DeliveryRecordStore } from "../stores/interfaces/delivery-record-store";
import type { DiscordRestClient } from "../delivery/mediums/discord/discord-rest-client";
import type { ArticleFieldStore } from "../articles/comparison";
import {
  handleFilterValidation,
  handleValidateDiscordPayload,
  handleDeliveryCount,
  handleDeliveryLogs,
  handleGetArticles,
  handlePreview,
  handleTest,
  handleDiagnoseArticle,
} from "./handlers";
import { jsonResponse, handleError } from "./utils";

/**
 * Context for HTTP server with injected dependencies.
 */
export interface HttpServerContext {
  deliveryRecordStore: DeliveryRecordStore;
  discordClient: DiscordRestClient;
  /** Override the feed requests service host (for testing) */
  feedRequestsServiceHost: string;
  /** Article field store for diagnosis */
  articleFieldStore?: ArticleFieldStore;
}

/**
 * Create the HTTP server with Bun.serve().
 */
export function createHttpServer(
  context: HttpServerContext,
  port: number
): Server<undefined> {
  return Bun.serve({
    port,
    routes: {
      "/v1/user-feeds/health": () => jsonResponse({ status: "ok" }),

      "/v1/user-feeds/filter-validation": {
        POST: (req) => handleFilterValidation(req),
      },

      "/v1/user-feeds/validate-discord-payload": {
        POST: (req) => handleValidateDiscordPayload(req),
      },

      "/v1/user-feeds/:feedId/delivery-count": {
        GET: (req) => {
          const url = new URL(req.url);
          const feedId = req.params.feedId;
          return handleDeliveryCount(
            req,
            url,
            feedId,
            context.deliveryRecordStore
          );
        },
      },

      "/v1/user-feeds/:feedId/delivery-logs": {
        GET: (req) => {
          const url = new URL(req.url);
          const feedId = req.params.feedId;
          return handleDeliveryLogs(
            req,
            url,
            feedId,
            context.deliveryRecordStore
          );
        },
      },

      "/v1/user-feeds/get-articles": {
        POST: (req) => handleGetArticles(req, context.feedRequestsServiceHost),
      },

      "/v1/user-feeds/preview": {
        POST: (req) => handlePreview(req, context.feedRequestsServiceHost),
      },

      "/v1/user-feeds/test": {
        POST: (req) =>
          handleTest(
            req,
            context.discordClient,
            context.feedRequestsServiceHost
          ),
      },

      "/v1/user-feeds/diagnose-articles": {
        POST: (req) => {
          if (!context.articleFieldStore) {
            return jsonResponse(
              { message: "Article field store not configured" },
              500
            );
          }
          return handleDiagnoseArticle(
            req,
            context.feedRequestsServiceHost,
            context.articleFieldStore,
            context.deliveryRecordStore
          );
        },
      },
    },
    fetch() {
      return jsonResponse({ error: "Not Found" }, 404);
    },
    error(err) {
      return handleError(err);
    },
  });
}

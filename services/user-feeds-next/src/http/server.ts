/**
 * Bun.serve() HTTP server setup
 */

import type { Server } from "bun";
import type { DeliveryRecordStore } from "../delivery-record-store";
import {
  handleFilterValidation,
  handleValidateDiscordPayload,
  handleDeliveryCount,
  handleDeliveryLogs,
  handleGetArticles,
  handlePreview,
} from "./handlers";
import { jsonResponse, handleError } from "./utils";

/**
 * Context for HTTP server with injected dependencies.
 */
export interface HttpServerContext {
  deliveryRecordStore: DeliveryRecordStore;
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
      "/health": () => jsonResponse({ status: "ok" }),

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
          return handleDeliveryCount(req, url, feedId, context.deliveryRecordStore);
        },
      },

      "/v1/user-feeds/:feedId/delivery-logs": {
        GET: (req) => {
          const url = new URL(req.url);
          const feedId = req.params.feedId;
          return handleDeliveryLogs(req, url, feedId, context.deliveryRecordStore);
        },
      },

      "/v1/user-feeds/get-articles": {
        POST: (req) => handleGetArticles(req),
      },

      "/v1/user-feeds/preview": {
        POST: (req) => handlePreview(req),
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

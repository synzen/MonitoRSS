import type { FastifyInstance } from "fastify";
import { requireAuthHook } from "../../infra/auth";
import { withExceptionFilter } from "../../shared/filters/exception-filter";
import {
  handleGetProductsHandler,
  handlePaddleWebhookHandler,
  handleChangePaymentMethodHandler,
  handleUpdatePreviewHandler,
  handleUpdateSubscriptionHandler,
  handleCancelSubscriptionHandler,
  handleResumeSubscriptionHandler,
} from "./supporter-subscriptions.handlers";
import {
  GetProductsQuerySchema,
  UpdatePreviewBodySchema,
} from "./supporter-subscriptions.schemas";
import { UPDATE_PREVIEW_EXCEPTION_ERROR_CODES } from "./supporter-subscriptions.exception-codes";

export async function supporterSubscriptionsRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get("/", {
    schema: {
      querystring: GetProductsQuerySchema,
    },
    handler: handleGetProductsHandler,
  });

  app.get("/change-payment-method", {
    preHandler: [requireAuthHook],
    handler: handleChangePaymentMethodHandler,
  });

  app.post("/update-preview", {
    schema: {
      body: UpdatePreviewBodySchema,
    },
    preHandler: [requireAuthHook],
    handler: withExceptionFilter(
      UPDATE_PREVIEW_EXCEPTION_ERROR_CODES,
      handleUpdatePreviewHandler,
    ),
  });

  app.post("/update", {
    schema: {
      body: UpdatePreviewBodySchema,
    },
    preHandler: [requireAuthHook],
    handler: withExceptionFilter(
      UPDATE_PREVIEW_EXCEPTION_ERROR_CODES,
      handleUpdateSubscriptionHandler,
    ),
  });

  app.get("/cancel", {
    preHandler: [requireAuthHook],
    handler: handleCancelSubscriptionHandler,
  });

  app.get("/resume", {
    preHandler: [requireAuthHook],
    handler: handleResumeSubscriptionHandler,
  });

  app.register(async (webhookScope) => {
    webhookScope.addContentTypeParser(
      "application/json",
      { parseAs: "buffer" },
      (_req, body, done) => done(null, body),
    );

    webhookScope.post("/paddle-webhook", {
      handler: handlePaddleWebhookHandler,
    });
  });
}

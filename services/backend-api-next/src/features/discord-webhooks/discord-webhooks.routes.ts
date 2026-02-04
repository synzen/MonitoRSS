import type { FastifyInstance } from "fastify";
import { getWebhookHandler } from "./discord-webhooks.handlers";
import { requireAuthHook } from "../../infra/auth";

interface WebhookParams {
  id: string;
}

export async function discordWebhooksRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get<{ Params: WebhookParams }>("/:id", {
    preHandler: [requireAuthHook],
    handler: getWebhookHandler,
  });
}

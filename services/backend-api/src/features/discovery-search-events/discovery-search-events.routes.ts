import type { FastifyInstance } from "fastify";
import { createDiscoverySearchEventHandler } from "./discovery-search-events.handlers";
import { CreateDiscoverySearchEventBodySchema } from "./discovery-search-events.schemas";
import { requireAuthHook } from "../../infra/auth";

export async function discoverySearchEventsRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post("/", {
    preHandler: [requireAuthHook],
    schema: {
      body: CreateDiscoverySearchEventBodySchema,
    },
    handler: createDiscoverySearchEventHandler,
  });
}

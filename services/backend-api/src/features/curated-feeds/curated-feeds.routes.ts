import type { FastifyInstance } from "fastify";
import { getCuratedFeedsHandler } from "./curated-feeds.handlers";
import { requireAuthHook } from "../../infra/auth";

export async function curatedFeedsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", {
    preHandler: [requireAuthHook],
    handler: getCuratedFeedsHandler,
  });
}

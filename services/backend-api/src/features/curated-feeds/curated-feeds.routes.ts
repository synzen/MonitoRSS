import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { getCuratedFeedsHandler } from "./curated-feeds.handlers";
import {
  GetCuratedFeedsQuerySchema,
  type GetCuratedFeedsQuery,
} from "./curated-feeds.schemas";
import { requireAuthHook } from "../../infra/auth";

export async function curatedFeedsRoutes(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, { global: false });

  app.get<{ Querystring: GetCuratedFeedsQuery }>("/", {
    preHandler: [requireAuthHook],
    schema: { querystring: GetCuratedFeedsQuerySchema },
    config: {
      rateLimit: {
        max: 60,
        timeWindow: "1 minute",
        allowList: (request) => {
          const { q, category } = request.query as GetCuratedFeedsQuery;
          return !!category && !q;
        },
      },
    },
    handler: getCuratedFeedsHandler,
  });
}

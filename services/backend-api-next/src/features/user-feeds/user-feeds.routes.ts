import type { FastifyInstance } from "fastify";
import { createUserFeedHandler } from "./user-feeds.handlers";
import { requireAuthHook } from "../../infra/auth";
import type { CreateUserFeedBody } from "./user-feeds.schemas";
import { createUserFeedBodySchema } from "./user-feeds.schemas";

export async function userFeedsRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: CreateUserFeedBody }>("/", {
    preHandler: [requireAuthHook],
    schema: { body: createUserFeedBodySchema },
    handler: createUserFeedHandler,
  });
}

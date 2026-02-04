import type { FastifyInstance } from "fastify";
import {
  createUserFeedHandler,
  deduplicateFeedUrlsHandler,
} from "./user-feeds.handlers";
import { requireAuthHook } from "../../infra/auth";
import type {
  CreateUserFeedBody,
  DeduplicateFeedUrlsBody,
} from "./user-feeds.schemas";
import {
  createUserFeedBodySchema,
  deduplicateFeedUrlsBodySchema,
} from "./user-feeds.schemas";

export async function userFeedsRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: DeduplicateFeedUrlsBody }>("/deduplicate-feed-urls", {
    preHandler: [requireAuthHook],
    schema: { body: deduplicateFeedUrlsBodySchema },
    handler: deduplicateFeedUrlsHandler,
  });

  app.post<{ Body: CreateUserFeedBody }>("/", {
    preHandler: [requireAuthHook],
    schema: { body: createUserFeedBodySchema },
    handler: createUserFeedHandler,
  });
}

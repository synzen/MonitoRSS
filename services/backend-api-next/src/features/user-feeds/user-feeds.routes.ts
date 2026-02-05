import type { FastifyInstance } from "fastify";
import {
  createUserFeedHandler,
  deduplicateFeedUrlsHandler,
  validateFeedUrlHandler,
} from "./user-feeds.handlers";
import { requireAuthHook } from "../../infra/auth";
import type {
  CreateUserFeedBody,
  DeduplicateFeedUrlsBody,
  ValidateUrlBody,
} from "./user-feeds.schemas";
import {
  createUserFeedBodySchema,
  deduplicateFeedUrlsBodySchema,
  validateUrlBodySchema,
} from "./user-feeds.schemas";

export async function userFeedsRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: DeduplicateFeedUrlsBody }>("/deduplicate-feed-urls", {
    preHandler: [requireAuthHook],
    schema: { body: deduplicateFeedUrlsBodySchema },
    handler: deduplicateFeedUrlsHandler,
  });

  app.post<{ Body: ValidateUrlBody }>("/url-validation", {
    preHandler: [requireAuthHook],
    schema: { body: validateUrlBodySchema },
    handler: validateFeedUrlHandler,
  });

  app.post<{ Body: CreateUserFeedBody }>("/", {
    preHandler: [requireAuthHook],
    schema: { body: createUserFeedBodySchema },
    handler: createUserFeedHandler,
  });
}

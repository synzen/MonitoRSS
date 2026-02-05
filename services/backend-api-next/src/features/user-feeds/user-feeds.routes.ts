import type { FastifyInstance } from "fastify";
import {
  createUserFeedHandler,
  deduplicateFeedUrlsHandler,
  getUserFeedHandler,
  validateFeedUrlHandler,
  updateUserFeedsHandler,
} from "./user-feeds.handlers";
import { requireAuthHook } from "../../infra/auth";
import type {
  CreateUserFeedBody,
  DeduplicateFeedUrlsBody,
  GetUserFeedParams,
  ValidateUrlBody,
  UpdateUserFeedsBody,
} from "./user-feeds.schemas";
import {
  createUserFeedBodySchema,
  deduplicateFeedUrlsBodySchema,
  getUserFeedParamsSchema,
  validateUrlBodySchema,
  updateUserFeedsBodySchema,
} from "./user-feeds.schemas";

export async function userFeedsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", requireAuthHook);

  app.post<{ Body: DeduplicateFeedUrlsBody }>("/deduplicate-feed-urls", {
    schema: { body: deduplicateFeedUrlsBodySchema },
    handler: deduplicateFeedUrlsHandler,
  });

  app.post<{ Body: ValidateUrlBody }>("/url-validation", {
    schema: { body: validateUrlBodySchema },
    handler: validateFeedUrlHandler,
  });

  app.post<{ Body: CreateUserFeedBody }>("/", {
    schema: { body: createUserFeedBodySchema },
    handler: createUserFeedHandler,
  });

  app.patch<{ Body: UpdateUserFeedsBody }>("/", {
    schema: { body: updateUserFeedsBodySchema },
    handler: updateUserFeedsHandler,
  });

  app.get<{ Params: GetUserFeedParams }>("/:feedId", {
    schema: { params: getUserFeedParamsSchema },
    handler: getUserFeedHandler,
  });
}

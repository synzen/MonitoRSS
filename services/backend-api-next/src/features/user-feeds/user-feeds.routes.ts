import type { FastifyInstance } from "fastify";
import {
  createUserFeedHandler,
  deduplicateFeedUrlsHandler,
  getUserFeedHandler,
  validateFeedUrlHandler,
  updateUserFeedsHandler,
  updateUserFeedHandler,
} from "./user-feeds.handlers";
import { requireAuthHook } from "../../infra/auth";
import type {
  CreateUserFeedBody,
  DeduplicateFeedUrlsBody,
  GetUserFeedParams,
  ValidateUrlBody,
  UpdateUserFeedsBody,
  UpdateUserFeedBody,
} from "./user-feeds.schemas";
import {
  createUserFeedBodySchema,
  deduplicateFeedUrlsBodySchema,
  getUserFeedParamsSchema,
  validateUrlBodySchema,
  updateUserFeedsBodySchema,
  updateUserFeedBodySchema,
} from "./user-feeds.schemas";
import { withExceptionFilter } from "../../shared/filters/exception-filter";
import {
  FEED_EXCEPTION_ERROR_CODES,
  UPDATE_USER_FEED_EXCEPTION_ERROR_CODES,
} from "./user-feeds.exception-codes";

export async function userFeedsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", requireAuthHook);

  app.post<{ Body: DeduplicateFeedUrlsBody }>("/deduplicate-feed-urls", {
    schema: { body: deduplicateFeedUrlsBodySchema },
    handler: deduplicateFeedUrlsHandler,
  });

  app.post<{ Body: ValidateUrlBody }>("/url-validation", {
    schema: { body: validateUrlBodySchema },
    handler: withExceptionFilter(
      FEED_EXCEPTION_ERROR_CODES,
      validateFeedUrlHandler,
    ),
  });

  app.post<{ Body: CreateUserFeedBody }>("/", {
    schema: { body: createUserFeedBodySchema },
    handler: withExceptionFilter(
      FEED_EXCEPTION_ERROR_CODES,
      createUserFeedHandler,
    ),
  });

  app.patch<{ Body: UpdateUserFeedsBody }>("/", {
    schema: { body: updateUserFeedsBodySchema },
    handler: updateUserFeedsHandler,
  });

  app.patch<{ Params: GetUserFeedParams; Body: UpdateUserFeedBody }>(
    "/:feedId",
    {
      schema: {
        params: getUserFeedParamsSchema,
        body: updateUserFeedBodySchema,
      },
      handler: withExceptionFilter(
        UPDATE_USER_FEED_EXCEPTION_ERROR_CODES,
        updateUserFeedHandler,
      ),
    },
  );

  app.get<{ Params: GetUserFeedParams }>("/:feedId", {
    schema: { params: getUserFeedParamsSchema },
    handler: getUserFeedHandler,
  });
}

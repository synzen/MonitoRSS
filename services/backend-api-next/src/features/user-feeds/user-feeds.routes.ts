import type { FastifyInstance } from "fastify";
import {
  cloneUserFeedHandler,
  copySettingsHandler,
  createUserFeedHandler,
  datePreviewHandler,
  deduplicateFeedUrlsHandler,
  deleteUserFeedHandler,
  deliveryPreviewHandler,
  getArticlePropertiesHandler,
  getArticlesHandler,
  getDailyLimitHandler,
  getDeliveryLogsHandler,
  getFeedRequestsHandler,
  getUserFeedHandler,
  manualRequestHandler,
  validateFeedUrlHandler,
  updateUserFeedsHandler,
  updateUserFeedHandler,
  sendTestArticleHandler,
} from "./user-feeds.handlers";
import { requireAuthHook } from "../../infra/auth";
import {
  CloneUserFeedBodySchema,
  CopySettingsBodySchema,
  CreateUserFeedBodySchema,
  DatePreviewBodySchema,
  DeduplicateFeedUrlsBodySchema,
  DeliveryPreviewBodySchema,
  GetArticlePropertiesBodySchema,
  GetArticlesBodySchema,
  GetDeliveryLogsQuerySchema,
  GetFeedRequestsQuerySchema,
  GetUserFeedParamsSchema,
  ValidateUrlBodySchema,
  UpdateUserFeedsBodySchema,
  UpdateUserFeedBodySchema,
  SendTestArticleBodySchema,
  type CloneUserFeedBody,
  type CopySettingsBody,
  type CreateUserFeedBody,
  type DatePreviewBody,
  type DeduplicateFeedUrlsBody,
  type DeliveryPreviewBody,
  type GetArticlePropertiesBody,
  type GetArticlesBody,
  type GetDeliveryLogsQuery,
  type GetFeedRequestsQuery,
  type GetUserFeedParams,
  type ValidateUrlBody,
  type UpdateUserFeedsBody,
  type UpdateUserFeedBody,
  type SendTestArticleBody,
} from "./user-feeds.schemas";
import { withExceptionFilter } from "../../shared/filters/exception-filter";
import {
  CLONE_USER_FEED_EXCEPTION_ERROR_CODES,
  FEED_EXCEPTION_ERROR_CODES,
  GET_ARTICLE_PROPERTIES_EXCEPTION_ERROR_CODES,
  GET_ARTICLES_EXCEPTION_ERROR_CODES,
  MANUAL_REQUEST_EXCEPTION_ERROR_CODES,
  SEND_TEST_ARTICLE_EXCEPTION_ERROR_CODES,
  UPDATE_USER_FEED_EXCEPTION_ERROR_CODES,
} from "./user-feeds.exception-codes";

export async function userFeedsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", requireAuthHook);

  app.post<{ Body: DeduplicateFeedUrlsBody }>("/deduplicate-feed-urls", {
    schema: { body: DeduplicateFeedUrlsBodySchema },
    handler: deduplicateFeedUrlsHandler,
  });

  app.post<{ Body: ValidateUrlBody }>("/url-validation", {
    schema: { body: ValidateUrlBodySchema },
    handler: withExceptionFilter(
      FEED_EXCEPTION_ERROR_CODES,
      validateFeedUrlHandler,
    ),
  });

  app.post<{ Body: CreateUserFeedBody }>("/", {
    schema: { body: CreateUserFeedBodySchema },
    handler: withExceptionFilter(
      FEED_EXCEPTION_ERROR_CODES,
      createUserFeedHandler,
    ),
  });

  app.patch<{ Body: UpdateUserFeedsBody }>("/", {
    schema: { body: UpdateUserFeedsBodySchema },
    handler: updateUserFeedsHandler,
  });

  app.post<{ Params: GetUserFeedParams; Body: CloneUserFeedBody }>(
    "/:feedId/clone",
    {
      schema: {
        params: GetUserFeedParamsSchema,
        body: CloneUserFeedBodySchema,
      },
      handler: withExceptionFilter(
        CLONE_USER_FEED_EXCEPTION_ERROR_CODES,
        cloneUserFeedHandler,
      ),
    },
  );

  app.post<{ Params: GetUserFeedParams; Body: SendTestArticleBody }>(
    "/:feedId/test-send",
    {
      schema: {
        params: GetUserFeedParamsSchema,
        body: SendTestArticleBodySchema,
      },
      handler: withExceptionFilter(
        SEND_TEST_ARTICLE_EXCEPTION_ERROR_CODES,
        sendTestArticleHandler,
      ),
    },
  );

  app.post<{ Params: GetUserFeedParams; Body: DatePreviewBody }>(
    "/:feedId/date-preview",
    {
      schema: {
        params: GetUserFeedParamsSchema,
        body: DatePreviewBodySchema,
      },
      handler: datePreviewHandler,
    },
  );

  app.post<{ Params: GetUserFeedParams; Body: DeliveryPreviewBody }>(
    "/:feedId/delivery-preview",
    {
      schema: {
        params: GetUserFeedParamsSchema,
        body: DeliveryPreviewBodySchema,
      },
      handler: deliveryPreviewHandler,
    },
  );

  app.post<{ Params: GetUserFeedParams; Body: GetArticlePropertiesBody }>(
    "/:feedId/get-article-properties",
    {
      schema: {
        params: GetUserFeedParamsSchema,
        body: GetArticlePropertiesBodySchema,
      },
      handler: withExceptionFilter(
        GET_ARTICLE_PROPERTIES_EXCEPTION_ERROR_CODES,
        getArticlePropertiesHandler,
      ),
    },
  );

  app.post<{ Params: GetUserFeedParams; Body: GetArticlesBody }>(
    "/:feedId/get-articles",
    {
      schema: {
        params: GetUserFeedParamsSchema,
        body: GetArticlesBodySchema,
      },
      handler: withExceptionFilter(
        GET_ARTICLES_EXCEPTION_ERROR_CODES,
        getArticlesHandler,
      ),
    },
  );

  app.post<{ Params: GetUserFeedParams }>("/:feedId/manual-request", {
    schema: { params: GetUserFeedParamsSchema },
    handler: withExceptionFilter(
      MANUAL_REQUEST_EXCEPTION_ERROR_CODES,
      manualRequestHandler,
    ),
  });

  app.post<{ Params: GetUserFeedParams; Body: CopySettingsBody }>(
    "/:feedId/copy-settings",
    {
      schema: {
        params: GetUserFeedParamsSchema,
        body: CopySettingsBodySchema,
      },
      handler: copySettingsHandler,
    },
  );

  app.patch<{ Params: GetUserFeedParams; Body: UpdateUserFeedBody }>(
    "/:feedId",
    {
      schema: {
        params: GetUserFeedParamsSchema,
        body: UpdateUserFeedBodySchema,
      },
      handler: withExceptionFilter(
        UPDATE_USER_FEED_EXCEPTION_ERROR_CODES,
        updateUserFeedHandler,
      ),
    },
  );

  app.delete<{ Params: GetUserFeedParams }>("/:feedId", {
    schema: { params: GetUserFeedParamsSchema },
    handler: deleteUserFeedHandler,
  });

  app.get<{ Params: GetUserFeedParams; Querystring: GetFeedRequestsQuery }>(
    "/:feedId/requests",
    {
      schema: {
        params: GetUserFeedParamsSchema,
        querystring: GetFeedRequestsQuerySchema,
      },
      handler: getFeedRequestsHandler,
    },
  );

  app.get<{ Params: GetUserFeedParams; Querystring: GetDeliveryLogsQuery }>(
    "/:feedId/delivery-logs",
    {
      schema: {
        params: GetUserFeedParamsSchema,
        querystring: GetDeliveryLogsQuerySchema,
      },
      handler: getDeliveryLogsHandler,
    },
  );

  app.get<{ Params: GetUserFeedParams }>("/:feedId/daily-limit", {
    schema: { params: GetUserFeedParamsSchema },
    handler: getDailyLimitHandler,
  });

  app.get<{ Params: GetUserFeedParams }>("/:feedId", {
    schema: { params: GetUserFeedParamsSchema },
    handler: getUserFeedHandler,
  });
}

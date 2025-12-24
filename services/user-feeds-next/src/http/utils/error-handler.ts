/**
 * Centralized error handling for HTTP API
 */

import { z } from "zod";
import {
  FeedRequestParseException,
  FeedRequestFetchException,
  FeedRequestBadStatusCodeException,
  FeedRequestTimedOutException,
  FeedArticleNotFoundException,
} from "../../feed-fetcher/exceptions";
import {
  CustomPlaceholderRegexEvalException,
  FiltersRegexEvalException,
} from "../../articles/formatter/exceptions";
import {
  FeedParseTimeoutException,
  InvalidFeedException,
} from "../../articles/parser";
import { jsonResponse } from "./response";
import { logger } from "../../shared/utils";

/**
 * Request status for get-articles endpoint.
 * Matches user-feeds GetFeedArticlesRequestStatus enum.
 */
export enum GetFeedArticlesRequestStatus {
  Success = "SUCCESS",
  ParseError = "PARSE_ERROR",
  FetchError = "FETCH_ERROR",
  BadStatusCode = "BAD_STATUS_CODE",
  TimedOut = "TIMED_OUT",
}

/**
 * Handle generic errors and return appropriate HTTP responses.
 */
export function handleError(err: unknown): Response {
  // Zod validation errors -> 400 BAD_REQUEST
  // Wrap in { message: [...] } to match backend-api expectations
  if (err instanceof z.ZodError) {
    return jsonResponse(
      {
        message: err.issues.map((issue: z.core.$ZodIssue) => ({
          path: issue.path,
          message: issue.message,
        })),
      },
      400
    );
  }

  // Custom placeholder regex errors -> 422 UNPROCESSABLE_ENTITY
  if (err instanceof CustomPlaceholderRegexEvalException) {
    return jsonResponse(
      {
        statusCode: 422,
        code: "CUSTOM_PLACEHOLDER_REGEX_EVAL",
        message: err.message,
        errors: err.regexErrors,
      },
      422
    );
  }

  // Filters regex errors -> 422 UNPROCESSABLE_ENTITY
  if (err instanceof FiltersRegexEvalException) {
    return jsonResponse(
      {
        statusCode: 422,
        code: "FILTERS_REGEX_EVAL",
        message: err.message,
        errors: err.regexErrors,
      },
      422
    );
  }

  // Article not found -> 404 NOT_FOUND
  if (err instanceof FeedArticleNotFoundException) {
    return jsonResponse({ message: err.message }, 404);
  }

  // Missing query parameter errors -> 400 BAD_REQUEST
  if (
    err instanceof Error &&
    err.message.startsWith("Missing required query")
  ) {
    return jsonResponse({ message: err.message }, 400);
  }

  // Invalid query parameter errors -> 400 BAD_REQUEST
  if (err instanceof Error && err.message.includes("must be an integer")) {
    return jsonResponse({ message: err.message }, 400);
  }

  // Invalid JSON body -> 400 BAD_REQUEST
  if (err instanceof Error && err.message === "Invalid JSON body") {
    return jsonResponse({ message: err.message }, 400);
  }

  // Fastify JSON parsing error -> 400 BAD_REQUEST
  if (
    err instanceof Error &&
    err.message.includes("Body is not valid JSON")
  ) {
    return jsonResponse({ message: "Invalid JSON body" }, 400);
  }

  // Unexpected errors -> 500 INTERNAL_SERVER_ERROR
  const exception = err as Error;
  logger.error(
    `Unhandled error - ${exception.message || String(err)}`,
    {
      exception: exception.stack || exception,
    }
  );
  return jsonResponse({ message: "Internal Server Error" }, 500);
}

/**
 * Special error handler for get-articles endpoint.
 * Maps domain exceptions to response statuses (not HTTP errors).
 */
export function handleGetArticlesError(err: unknown, url: string): Response {
  if (
    err instanceof FeedRequestParseException ||
    err instanceof InvalidFeedException
  ) {
    return jsonResponse({
      result: {
        requestStatus: GetFeedArticlesRequestStatus.ParseError,
        articles: [],
        totalArticles: 0,
        selectedProperties: [],
        url,
        attemptedToResolveFromHtml: true,
        feedTitle: null,
      },
    });
  }

  if (err instanceof FeedRequestFetchException) {
    return jsonResponse({
      result: {
        requestStatus: GetFeedArticlesRequestStatus.FetchError,
        articles: [],
        totalArticles: 0,
        selectedProperties: [],
        url,
        attemptedToResolveFromHtml: false,
        feedTitle: null,
      },
    });
  }

  if (err instanceof FeedRequestBadStatusCodeException) {
    return jsonResponse({
      result: {
        requestStatus: GetFeedArticlesRequestStatus.BadStatusCode,
        articles: [],
        totalArticles: 0,
        response: { statusCode: err.statusCode },
        selectedProperties: [],
        url,
        attemptedToResolveFromHtml: false,
        feedTitle: null,
      },
    });
  }

  if (
    err instanceof FeedRequestTimedOutException ||
    err instanceof FeedParseTimeoutException
  ) {
    return jsonResponse({
      result: {
        requestStatus: GetFeedArticlesRequestStatus.TimedOut,
        articles: [],
        totalArticles: 0,
        selectedProperties: [],
        url,
        attemptedToResolveFromHtml: false,
        feedTitle: null,
      },
    });
  }

  // Fall through to generic error handler
  return handleError(err);
}

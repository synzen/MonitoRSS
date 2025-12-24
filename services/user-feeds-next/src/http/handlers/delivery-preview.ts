/**
 * Handler for POST /v1/user-feeds/delivery-preview
 * Generates a preview of what would happen to specific articles when processed.
 */

import { z } from "zod";
import { withAuth } from "../middleware";
import { jsonResponse, parseJsonBody } from "../utils";
import { deliveryPreviewInputSchema } from "../schemas";
import {
  generateDeliveryPreview,
  FeedState,
  ArticleDeliveryOutcome,
  CANONICAL_STAGES,
  type DeliveryPreviewInput,
  endDeliveryPreviewEarly,
} from "../../delivery-preview";
import type { ArticleFieldStore } from "../../articles/comparison";
import type { DeliveryRecordStore } from "../../stores/interfaces/delivery-record-store";
import type { ResponseHashStore } from "../../feeds/feed-event-handler";
import type { LogicalExpression } from "../../articles/filters";
import {
  fetchAndParseFeed,
  getHashToCompare,
  type FeedProcessingResult,
} from "../../feeds/shared-processing";
import { fetchFeedForDeliveryPreview } from "../../feed-fetcher";

type FeedErrorResult = Extract<
  FeedProcessingResult,
  { status: "fetch-error" } | { status: "parse-error" }
>;

function createErrorResponse(feedResult: FeedErrorResult): Response {
  if (feedResult.status === "fetch-error") {
    return jsonResponse({
      results: [],
      errors: [
        {
          message: `Feed fetch error (${feedResult.errorType}): ${feedResult.message}`,
        },
      ],
      total: 0,
      stages: CANONICAL_STAGES,
      feedState: {
        state: FeedState.FetchError,
        errorType: feedResult.errorType,
        httpStatusCode: feedResult.statusCode,
      },
    });
  }

  return jsonResponse({
    results: [],
    errors: [
      {
        message: `Feed parse error (${feedResult.errorType}): ${feedResult.message}`,
      },
    ],
    total: 0,
    stages: CANONICAL_STAGES,
    feedState: {
      state: FeedState.ParseError,
      errorType: feedResult.errorType,
    },
  });
}

export async function handleDeliveryPreview(
  req: Request,
  feedRequestsServiceHost: string,
  articleFieldStore: ArticleFieldStore,
  deliveryRecordStore: DeliveryRecordStore,
  responseHashStore: ResponseHashStore
): Promise<Response> {
  return withAuth(req, async () => {
    try {
      const body = await parseJsonBody<unknown>(req);
      const input = deliveryPreviewInputSchema.parse(body);

      // Get stored hash for comparison (only if prior articles exist)
      const hashToCompare = await getHashToCompare(
        input.feed.id,
        articleFieldStore,
        responseHashStore
      );

      // Use shared processing to fetch and parse feed with the delivery preview endpoint
      // This endpoint checks staleness against ANY request status (including errors)
      const feedResult = await fetchAndParseFeed(
        {
          feed: {
            url: input.feed.url,
            formatOptions: input.feed.formatOptions,
            externalProperties: input.feed.externalProperties,
            requestLookupDetails: input.feed.requestLookupDetails,
          },
          feedRequestsServiceHost,
          stalenessThresholdSeconds: input.feed.refreshRateSeconds,
          hashToCompare,
        },
        { fetchFeedFn: fetchFeedForDeliveryPreview }
      );

      // Handle matched-hash by re-fetching without hash comparison to get articles
      if (feedResult.status === "matched-hash") {
        endDeliveryPreviewEarly();
        // Re-fetch without hash comparison to get the actual articles
        const feedResultWithArticles = await fetchAndParseFeed(
          {
            feed: {
              url: input.feed.url,
              formatOptions: input.feed.formatOptions,
              externalProperties: input.feed.externalProperties,
              requestLookupDetails: input.feed.requestLookupDetails,
            },
            feedRequestsServiceHost,
            stalenessThresholdSeconds: input.feed.refreshRateSeconds,
          },
          { fetchFeedFn: fetchFeedForDeliveryPreview }
        );

        // If re-fetch fails, treat as error (shouldn't happen normally)
        if (
          feedResultWithArticles.status === "fetch-error" ||
          feedResultWithArticles.status === "parse-error"
        ) {
          return createErrorResponse(feedResultWithArticles);
        }

        // matched-hash on re-fetch shouldn't happen since we didn't pass hashToCompare
        if (feedResultWithArticles.status === "matched-hash") {
          return jsonResponse({
            results: [],
            errors: [{ message: "Unexpected matched-hash on re-fetch" }],
            total: 0,
            stages: CANONICAL_STAGES,
          });
        }

        // Return articles with FeedUnchanged outcome for each medium
        const allArticles = feedResultWithArticles.articles;
        const total = allArticles.length;
        const targetArticles = allArticles.slice(
          input.skip,
          input.skip + input.limit
        );

        const results = targetArticles.map((article) => ({
          articleId: article.flattened.id,
          articleIdHash: article.flattened.idHash,
          articleTitle: article.flattened.title || null,
          outcome: ArticleDeliveryOutcome.FeedUnchanged,
          outcomeReason:
            "Feed content unchanged since last check. Articles will be processed when new content is detected.",
          mediumResults: input.mediums.map((medium) => ({
            mediumId: medium.id,
            outcome: ArticleDeliveryOutcome.FeedUnchanged,
            outcomeReason:
              "Feed content unchanged since last check. Articles will be processed when new content is detected.",
            stages: [],
          })),
        }));

        return jsonResponse({ results, errors: [], total, stages: CANONICAL_STAGES });
      }

      if (
        feedResult.status === "fetch-error" ||
        feedResult.status === "parse-error"
      ) {
        endDeliveryPreviewEarly()
        return createErrorResponse(feedResult);
      }

      // Success - apply pagination and continue with delivery preview
      const allArticles = feedResult.articles;
      const total = allArticles.length;
      const targetArticles = allArticles.slice(
        input.skip,
        input.skip + input.limit
      );

      // Map mediums to properly type the filter expressions
      const mediums: DeliveryPreviewInput["mediums"] = input.mediums.map(
        (m) => ({
          id: m.id,
          rateLimits: m.rateLimits,
          filters: m.filters
            ? { expression: m.filters.expression as LogicalExpression }
            : undefined,
        })
      );

      const { results, errors } = await generateDeliveryPreview(
        {
          feed: {
            id: input.feed.id,
            blockingComparisons: input.feed.blockingComparisons,
            passingComparisons: input.feed.passingComparisons,
            dateChecks: input.feed.dateChecks,
          },
          mediums,
          articleDayLimit: input.articleDayLimit,
          allArticles,
          targetArticles,
          summaryOnly: input.summaryOnly,
        },
        {
          articleFieldStore,
          deliveryRecordStore,
        }
      );

      return jsonResponse({ results, errors, total, stages: CANONICAL_STAGES });
    } catch (err) {
      // Handle Zod validation errors
      if (err instanceof z.ZodError) {
        return jsonResponse(
          err.issues.map((issue: z.core.$ZodIssue) => ({
            path: issue.path,
            message: issue.message,
          })),
          400
        );
      }

      throw err;
    }
  });
}

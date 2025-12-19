/**
 * Handler for POST /v1/user-feeds/diagnose-articles
 * Diagnoses what would happen to specific articles when processed.
 */

import { z } from "zod";
import { withAuth } from "../middleware";
import { jsonResponse, parseJsonBody } from "../utils";
import { diagnoseArticleInputSchema } from "../schemas";
import {
  diagnoseArticles,
  FeedState,
  ArticleDiagnosisOutcome,
  type DiagnoseArticlesInput,
} from "../../diagnostics";
import type { ArticleFieldStore } from "../../articles/comparison";
import type { DeliveryRecordStore } from "../../stores/interfaces/delivery-record-store";
import type { ResponseHashStore } from "../../feeds/feed-event-handler";
import type { LogicalExpression } from "../../articles/filters";
import {
  fetchAndParseFeed,
  getHashToCompare,
  type FeedProcessingResult,
} from "../../feeds/shared-processing";

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
    feedState: {
      state: FeedState.ParseError,
      errorType: feedResult.errorType,
    },
  });
}

export async function handleDiagnoseArticle(
  req: Request,
  feedRequestsServiceHost: string,
  articleFieldStore: ArticleFieldStore,
  deliveryRecordStore: DeliveryRecordStore,
  responseHashStore: ResponseHashStore
): Promise<Response> {
  return withAuth(req, async () => {
    try {
      const body = await parseJsonBody<unknown>(req);
      const input = diagnoseArticleInputSchema.parse(body);
      
      // Get stored hash for comparison (only if prior articles exist)
      const hashToCompare = await getHashToCompare(
        input.feed.id,
        articleFieldStore,
        responseHashStore
      );

      // Use shared processing to fetch and parse feed
      const feedResult = await fetchAndParseFeed({
        feed: {
          url: input.feed.url,
          formatOptions: input.feed.formatOptions,
          externalProperties: input.feed.externalProperties,
          requestLookupDetails: input.feed.requestLookupDetails,
        },
        feedRequestsServiceHost,
        hashToCompare,
      });

      // Handle matched-hash by re-fetching without hash comparison to get articles
      if (feedResult.status === "matched-hash") {
        // Re-fetch without hash comparison to get the actual articles
        const feedResultWithArticles = await fetchAndParseFeed({
          feed: {
            url: input.feed.url,
            formatOptions: input.feed.formatOptions,
            externalProperties: input.feed.externalProperties,
            requestLookupDetails: input.feed.requestLookupDetails,
          },
          feedRequestsServiceHost,
          // No hashToCompare - force full fetch
        });

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
          outcome: ArticleDiagnosisOutcome.FeedUnchanged,
          outcomeReason:
            "Feed content unchanged since last check. Articles will be processed when new content is detected.",
          mediumResults: input.mediums.map((medium) => ({
            mediumId: medium.id,
            outcome: ArticleDiagnosisOutcome.FeedUnchanged,
            outcomeReason:
              "Feed content unchanged since last check. Articles will be processed when new content is detected.",
            stages: [],
          })),
        }));

        return jsonResponse({ results, errors: [], total });
      }

      if (
        feedResult.status === "fetch-error" ||
        feedResult.status === "parse-error"
      ) {
        return createErrorResponse(feedResult);
      }

      // Success - apply pagination and continue with diagnosis
      const allArticles = feedResult.articles;
      const total = allArticles.length;
      const targetArticles = allArticles.slice(
        input.skip,
        input.skip + input.limit
      );

      // Map mediums to properly type the filter expressions
      const mediums: DiagnoseArticlesInput["mediums"] = input.mediums.map(
        (m) => ({
          id: m.id,
          rateLimits: m.rateLimits,
          filters: m.filters
            ? { expression: m.filters.expression as LogicalExpression }
            : undefined,
        })
      );

      const { results, errors } = await diagnoseArticles(
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

      return jsonResponse({ results, errors, total });
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

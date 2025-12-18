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
  type DiagnoseArticlesInput,
  ArticleDiagnosisOutcome,
} from "../../diagnostics";
import type { ArticleFieldStore } from "../../articles/comparison";
import type { DeliveryRecordStore } from "../../stores/interfaces/delivery-record-store";
import type { ResponseHashStore } from "../../feeds/feed-event-handler";
import type { LogicalExpression } from "../../articles/filters";
import {
  fetchAndParseFeed,
  getHashToCompare,
} from "../../feeds/shared-processing";

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

      // Handle non-success results
      if (feedResult.status === "matched-hash") {
        return jsonResponse({
          results: input.articleIds.map((articleId) => ({
            articleId,
            articleIdHash: null,
            articleTitle: null,
            outcome: ArticleDiagnosisOutcome.FeedUnchanged,
            outcomeReason:
              "Feed content has not changed since last processing.",
          })),
          errors: [],
        });
      }

      if (feedResult.status === "pending") {
        return jsonResponse({
          results: [],
          errors: [
            {
              articleId: "*",
              message: "Feed request is pending. Try again later.",
            },
          ],
        });
      }

      if (
        feedResult.status === "fetch-error" ||
        feedResult.status === "parse-error"
      ) {
        const errorDesc =
          feedResult.status === "fetch-error" ? "fetch" : "parse";
        return jsonResponse({
          results: input.articleIds.map((articleId) => ({
            articleId,
            articleIdHash: null,
            articleTitle: null,
            outcome: ArticleDiagnosisOutcome.FeedError,
            outcomeReason: `Feed ${errorDesc} error (${feedResult.errorType}): ${feedResult.message}`,
          })),
          errors: [],
        });
      }

      // Success - continue with diagnosis
      const fetchArticles = async () => feedResult.articles;

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
          articleIds: input.articleIds,
          summaryOnly: input.summaryOnly,
        },
        {
          articleFieldStore,
          deliveryRecordStore,
          fetchArticles,
        }
      );

      return jsonResponse({ results, errors });
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

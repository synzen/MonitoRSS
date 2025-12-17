/**
 * Handler for POST /v1/user-feeds/diagnose-articles
 * Diagnoses what would happen to specific articles when processed.
 */

import { z } from "zod";
import { withAuth } from "../middleware";
import { jsonResponse, parseJsonBody } from "../utils";
import { diagnoseArticleInputSchema } from "../schemas";
import { findOrFetchFeedArticles } from "../../feeds/services/articles.service";
import { diagnoseArticles, type DiagnoseArticlesInput } from "../../diagnostics";
import type { ArticleFieldStore } from "../../articles/comparison";
import type { DeliveryRecordStore } from "../../stores/interfaces/delivery-record-store";
import type { LogicalExpression } from "../../articles/filters";

export async function handleDiagnoseArticle(
  req: Request,
  feedRequestsServiceHost: string,
  articleFieldStore: ArticleFieldStore,
  deliveryRecordStore: DeliveryRecordStore
): Promise<Response> {
  return withAuth(req, async () => {
    try {
      const body = await parseJsonBody<unknown>(req);
      const input = diagnoseArticleInputSchema.parse(body);

      // Fetch articles from the feed
      const { output: fetchResult } = await findOrFetchFeedArticles(
        input.feed.url,
        {
          formatOptions: {},
          externalFeedProperties: [],
          findRssFromHtml: false,
          executeFetchIfStale: true,
          feedRequestsServiceHost,
        }
      );

      // Create fetchArticles function that returns the already-fetched articles
      const fetchArticles = async () => fetchResult.articles;

      // Map mediums to properly type the filter expressions
      const mediums: DiagnoseArticlesInput["mediums"] = input.mediums.map((m) => ({
        id: m.id,
        rateLimits: m.rateLimits,
        filters: m.filters
          ? { expression: m.filters.expression as LogicalExpression }
          : undefined,
      }));

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

/**
 * Handler for POST /v1/user-feeds/get-articles
 * Fetches and filters articles from RSS feeds.
 */

import { withAuth } from "../middleware";
import {
  jsonResponse,
  parseJsonBody,
  handleGetArticlesError,
  GetFeedArticlesRequestStatus,
} from "../utils";
import {
  getArticlesInputSchema,
  GetUserFeedArticlesFilterReturnType,
} from "../schemas";
import { findOrFetchFeedArticles } from "../../feeds/services/articles.service";
import { paginateArticles } from "../../feeds/services/feeds.service";
import {
  formatArticleForDiscord,
  CustomPlaceholderStepType,
} from "../../articles/formatter";
import {
  CustomPlaceholderRegexEvalException,
  FiltersRegexEvalException,
} from "../../articles/formatter/exceptions";
import { enrichFlattenedArticle } from "../../articles/parser";
import {
  evaluateExpression,
  buildFilterReferences,
  type LogicalExpression,
} from "../../articles/filters";

/**
 * Convert schema custom placeholders to the format expected by formatArticleForDiscord.
 * Supports all step types: Regex, UrlEncode, DateFormat, Uppercase, Lowercase.
 */
function convertCustomPlaceholders(
  schemaPlaceholders:
    | Array<{
        id: string;
        referenceName: string;
        sourcePlaceholder: string;
        steps: Array<{
          type: CustomPlaceholderStepType;
          regexSearch?: string;
          regexSearchFlags?: string | null;
          replacementString?: string | null;
          format?: string;
          timezone?: string | null;
          locale?: string | null;
        }>;
      }>
    | null
    | undefined
) {
  if (!schemaPlaceholders?.length) {
    return undefined;
  }

  return schemaPlaceholders.map((cp) => ({
    id: cp.id,
    referenceName: cp.referenceName,
    sourcePlaceholder: cp.sourcePlaceholder,
    steps: cp.steps.map((step) => ({
      type: step.type,
      regexSearch: step.regexSearch,
      regexSearchFlags: step.regexSearchFlags ?? undefined,
      replacementString: step.replacementString ?? undefined,
      format: step.format,
      timezone: step.timezone ?? undefined,
      locale: step.locale ?? undefined,
    })),
  }));
}

export async function handleGetArticles(
  req: Request,
  feedRequestsServiceHost: string
): Promise<Response> {
  return withAuth(req, async () => {
    const body = await parseJsonBody<unknown>(req);
    const input = getArticlesInputSchema.parse(body);

    try {
      const {
        output: fetchResult,
        url: resolvedUrl,
        attemptedToResolveFromHtml,
      } = await findOrFetchFeedArticles(input.url, {
        formatOptions: {
          dateFormat: input.formatter.options.dateFormat,
          dateTimezone: input.formatter.options.dateTimezone,
          disableImageLinkPreviews:
            input.formatter.options.disableImageLinkPreviews,
          dateLocale: input.formatter.options.dateLocale,
        },
        externalFeedProperties: input.formatter.externalProperties ?? [],
        includeHtmlInErrors: input.includeHtmlInErrors,
        findRssFromHtml: input.findRssFromHtml,
        executeFetch: input.executeFetch,
        executeFetchIfStale: input.executeFetchIfStale,
        requestLookupDetails: input.requestLookupDetails
          ? {
              key: input.requestLookupDetails.key,
              url: input.requestLookupDetails.url ?? undefined,
              headers: input.requestLookupDetails.headers as
                | Record<string, string>
                | undefined,
            }
          : null,
        feedRequestsServiceHost,
        lightweight: true,
      });

      if (fetchResult.articles.length === 0) {
        return jsonResponse({
          result: {
            requestStatus: GetFeedArticlesRequestStatus.Success,
            articles: [],
            totalArticles: 0,
            selectedProperties: [],
            url: resolvedUrl,
            attemptedToResolveFromHtml,
            feedTitle: fetchResult.feed.title || null,
            externalContentErrors: fetchResult.externalContentErrors,
          },
        });
      }

      // Step 1: Paginate on lightweight (unformatted) articles
      const {
        articles: paginatedArticles,
        totalArticles,
        properties,
      } = paginateArticles({
        articles: fetchResult.articles,
        limit: input.limit,
        skip: input.skip,
        random: input.random,
        selectProperties: input.selectProperties,
        selectPropertyTypes: input.selectPropertyTypes,
        customPlaceholders: input.formatter.customPlaceholders,
        filters: {
          articleId: input.filters?.articleId,
          articleIdHashes: input.filters?.articleIdHashes,
          search: input.filters?.search,
        },
      });

      // Step 2: Enrich the paginated subset with extracted::/processed:: fields
      const enrichedArticles = paginatedArticles.map((article) => ({
        ...article,
        flattened: {
          ...enrichFlattenedArticle(
            // Strip id/idHash before enrichment (they're not content fields)
            Object.fromEntries(
              Object.entries(article.flattened).filter(
                ([k]) => k !== "id" && k !== "idHash"
              )
            ),
            {}
          ),
          id: article.flattened.id,
          idHash: article.flattened.idHash,
        },
      }));

      // Step 3: Format only the paginated subset for Discord
      const formattedArticles = enrichedArticles.map(
        (article) =>
          formatArticleForDiscord(article, {
            ...input.formatter.options,
            customPlaceholders: convertCustomPlaceholders(
              input.formatter.customPlaceholders
            ),
          }).article
      );

      // Step 4: Trim to selected properties
      const trimmedArticles = formattedArticles.map((article) => {
        const trimmed = {
          ...article,
          flattened: {
            id: article.flattened.id,
            idHash: article.flattened.idHash,
          } as Record<string, string> & { id: string; idHash: string },
        };

        properties.forEach((property) => {
          trimmed.flattened[property] = article.flattened[property] || "";
        });

        return trimmed;
      });

      // Step 5: Evaluate filter expressions on formatted articles if requested
      let filterEvalResults: Array<{ passed: boolean }> | undefined;

      if (
        input.filters?.returnType ===
        GetUserFeedArticlesFilterReturnType.IncludeEvaluationResults
      ) {
        if (input.filters.expression) {
          filterEvalResults = await Promise.all(
            formattedArticles.map(async (article) => {
              const { result: passed } = evaluateExpression(
                input.filters!.expression as unknown as LogicalExpression,
                buildFilterReferences(article)
              );

              return { passed };
            })
          );
        } else {
          filterEvalResults = formattedArticles.map(() => ({ passed: true }));
        }
      }

      // Filter external content errors to only include those for returned articles
      const returnedArticleIds = new Set(
        trimmedArticles.map((a) => a.flattened.id)
      );
      const filteredErrors = fetchResult.externalContentErrors?.filter((err) =>
        returnedArticleIds.has(err.articleId)
      );

      return jsonResponse({
        result: {
          requestStatus: GetFeedArticlesRequestStatus.Success,
          articles: trimmedArticles.map((a) => a.flattened),
          totalArticles,
          filterStatuses: filterEvalResults,
          selectedProperties: properties,
          url: resolvedUrl,
          attemptedToResolveFromHtml,
          feedTitle: fetchResult.feed.title || null,
          externalContentErrors:
            filteredErrors && filteredErrors.length > 0
              ? filteredErrors
              : undefined,
        },
      });
    } catch (err) {
      // Handle regex evaluation errors
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

      // Handle feed fetch errors (return as success with error status)
      return handleGetArticlesError(err, input.url);
    }
  });
}

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
import { getArticlesInputSchema } from "../schemas";
import { findOrFetchFeedArticles } from "../../services/articles.service";
import { queryForArticles } from "../../services/feeds.service";
import {
  formatValueForDiscord,
  processCustomPlaceholders,
  CustomPlaceholderStepType,
} from "../../article-formatter";
import type { Article } from "../../article-parser";
import {
  CustomPlaceholderRegexEvalException,
  FiltersRegexEvalException,
} from "../../article-formatter/exceptions";

/**
 * Format an article for Discord output.
 * Matches DiscordMediumService.formatArticle behavior.
 */
async function formatArticleForDiscord(
  article: Article,
  options: {
    stripImages?: boolean;
    formatTables?: boolean;
    disableImageLinkPreviews?: boolean;
    ignoreNewLines?: boolean;
    customPlaceholders?: Array<{
      id: string;
      referenceName: string;
      sourcePlaceholder: string;
      steps: Array<{
        regexSearch?: string;
        regexSearchFlags?: string;
        replacementString?: string | null;
      }>;
    }> | null;
  }
): Promise<Article> {
  const flattened: Article["flattened"] = {
    id: article.flattened.id,
    idHash: article.flattened.idHash,
  };

  // Format each property for Discord
  for (const [key, value] of Object.entries(article.flattened)) {
    if (key === "id" || key === "idHash") continue;

    const { value: formatted } = formatValueForDiscord(value, {
      stripImages: options.stripImages,
      formatTables: options.formatTables,
      disableImageLinkPreviews: options.disableImageLinkPreviews,
      ignoreNewLines: options.ignoreNewLines,
    });
    flattened[key] = formatted;
  }

  // Process custom placeholders
  if (options.customPlaceholders?.length) {
    const customPlaceholderSteps = options.customPlaceholders.map((cp) => ({
      id: cp.id,
      referenceName: cp.referenceName,
      sourcePlaceholder: cp.sourcePlaceholder,
      steps: cp.steps.map((step) => ({
        type: CustomPlaceholderStepType.Regex,
        regexSearch: step.regexSearch,
        regexSearchFlags: step.regexSearchFlags ?? undefined,
        replacementString: step.replacementString ?? undefined,
      })),
    }));

    const withCustom = processCustomPlaceholders(
      flattened,
      customPlaceholderSteps
    );

    return { flattened: withCustom, raw: article.raw };
  }

  return { flattened, raw: article.raw };
}

export async function handleGetArticles(req: Request): Promise<Response> {
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
          },
        });
      }

      // Format articles for Discord
      const formattedArticles = await Promise.all(
        fetchResult.articles.map((article) =>
          formatArticleForDiscord(article, {
            ...input.formatter.options,
            customPlaceholders: input.formatter.customPlaceholders,
          })
        )
      );

      const {
        articles: matchedArticles,
        properties,
        filterEvalResults,
        totalArticles,
      } = await queryForArticles({
        articles: formattedArticles,
        limit: input.limit,
        skip: input.skip,
        selectProperties: input.selectProperties,
        filters: input.filters,
        random: input.random,
        selectPropertyTypes: input.selectPropertyTypes,
        customPlaceholders: input.formatter.customPlaceholders,
      });

      return jsonResponse({
        result: {
          requestStatus: GetFeedArticlesRequestStatus.Success,
          articles: matchedArticles.map((a) => a.flattened),
          totalArticles,
          filterStatuses: filterEvalResults,
          selectedProperties: properties,
          url: resolvedUrl,
          attemptedToResolveFromHtml,
          feedTitle: fetchResult.feed.title || null,
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

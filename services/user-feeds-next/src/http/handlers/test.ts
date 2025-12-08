/**
 * Handler for POST /v1/user-feeds/test
 * Sends a test article to Discord, matching user-feeds behavior.
 */

import { z } from "zod";
import { withAuth } from "../middleware";
import { jsonResponse, parseJsonBody, handleError } from "../utils";
import {
  fetchFeedArticle,
  fetchRandomFeedArticle,
} from "../../services/articles.service";
import {
  discordMediumTestPayloadDetailsSchema,
  externalFeedPropertySchema,
  feedV2EventRequestLookupDetails,
  feedV2EventSchemaFormatOptions,
  feedV2EventSchemaDateChecks,
} from "../../schemas/feed-v2-event.schema";
import {
  formatArticleForDiscord,
  CustomPlaceholderStepType,
  type CustomPlaceholder,
  type MentionTarget,
  type ForumThreadTag,
} from "../../article-formatter";
import type { Article } from "../../article-parser";
import { buildFilterReferences } from "../../article-filters";
import {
  CustomPlaceholderRegexEvalException,
  FiltersRegexEvalException,
} from "../../article-formatter/exceptions";
import { FeedArticleNotFoundException } from "../../feed-fetcher/exceptions";
import {
  deliverTestArticle,
  type TestDiscordMediumDetails,
} from "../../delivery/mediums/discord/discord-test-delivery";
import type { DiscordRestClient } from "../../discord-rest";
import { TestDeliveryMedium, TestDeliveryStatus } from "../../constants";

/**
 * Convert schema custom placeholders to the CustomPlaceholder[] format.
 */
function convertCustomPlaceholders(
  schemaPlaceholders:
    | Array<{
        id: string;
        referenceName: string;
        sourcePlaceholder: string;
        steps: Array<{
          type: string;
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
): CustomPlaceholder[] | undefined {
  if (!schemaPlaceholders?.length) {
    return undefined;
  }

  return schemaPlaceholders.map((cp) => ({
    id: cp.id,
    referenceName: cp.referenceName,
    sourcePlaceholder: cp.sourcePlaceholder,
    steps: cp.steps.map((step) => {
      if (step.type === CustomPlaceholderStepType.Regex) {
        return {
          type: CustomPlaceholderStepType.Regex,
          regexSearch: step.regexSearch!,
          regexSearchFlags: step.regexSearchFlags ?? undefined,
          replacementString: step.replacementString ?? undefined,
        };
      }
      if (step.type === CustomPlaceholderStepType.DateFormat) {
        return {
          type: CustomPlaceholderStepType.DateFormat,
          format: step.format!,
          timezone: step.timezone ?? undefined,
          locale: step.locale ?? undefined,
        };
      }
      // UrlEncode, Uppercase, Lowercase only have type
      return { type: step.type as CustomPlaceholderStepType };
    }),
  }));
}

export async function handleTest(
  req: Request,
  discordClient: DiscordRestClient,
  feedRequestsServiceHost: string
): Promise<Response> {
  return withAuth(req, async () => {
    try {
      const payload = await parseJsonBody<Record<string, unknown>>(req);

      // Parse common fields
      const {
        type,
        article: dtoArticle,
        feed,
      } = z
        .object({
          type: z.enum(TestDeliveryMedium),
          feed: z.object({
            url: z.string(),
            formatOptions: feedV2EventSchemaFormatOptions
              .optional()
              .nullable()
              .default(null),
            dateChecks: feedV2EventSchemaDateChecks
              .optional()
              .nullable()
              .default(null),
            externalProperties: z
              .array(externalFeedPropertySchema)
              .optional()
              .nullable()
              .default(null),
            requestLookupDetails: feedV2EventRequestLookupDetails
              .optional()
              .nullable(),
          }),
          article: z
            .object({
              id: z.string(),
            })
            .nullable()
            .optional()
            .default(null),
        })
        .parse(payload);

      if (type === TestDeliveryMedium.Discord) {
        // Parse Discord-specific medium details
        const { mediumDetails } = z
          .object({
            mediumDetails: discordMediumTestPayloadDetailsSchema,
          })
          .parse(payload);

        // Build format options
        const formatOptions = {
          dateFormat: feed.formatOptions?.dateFormat,
          dateTimezone: feed.formatOptions?.dateTimezone,
          disableImageLinkPreviews:
            mediumDetails.formatter?.disableImageLinkPreviews,
          dateLocale: feed.formatOptions?.dateLocale,
        };

        // Fetch article (random or specific)
        let article: Article | null = null;

        if (!dtoArticle) {
          article = await fetchRandomFeedArticle(feed.url, {
            formatOptions,
            externalFeedProperties: feed.externalProperties || [],
            requestLookupDetails: feed.requestLookupDetails
              ? {
                  key: feed.requestLookupDetails.key,
                  url: feed.requestLookupDetails.url ?? undefined,
                  headers: feed.requestLookupDetails.headers as
                    | Record<string, string>
                    | undefined,
                }
              : null,
            feedRequestsServiceHost,
          });
        } else {
          article = await fetchFeedArticle(feed.url, dtoArticle.id, {
            formatOptions,
            externalFeedProperties: feed.externalProperties || [],
            requestLookupDetails: feed.requestLookupDetails
              ? {
                  key: feed.requestLookupDetails.key,
                  url: feed.requestLookupDetails.url ?? undefined,
                  headers: feed.requestLookupDetails.headers as
                    | Record<string, string>
                    | undefined,
                }
              : null,
            feedRequestsServiceHost,
          });
        }

        if (!article) {
          return jsonResponse({
            status: TestDeliveryStatus.NoArticles,
            operationType: undefined,
          });
        }

        // Convert custom placeholders
        const customPlaceholders = convertCustomPlaceholders(
          mediumDetails.customPlaceholders
        );

        // Format article for Discord
        const formattedArticle = formatArticleForDiscord(article, {
          ...mediumDetails.formatter,
          customPlaceholders,
        });

        // Build filter references
        const filterReferences = buildFilterReferences(formattedArticle);

        // Build medium details for delivery
        const deliveryMediumDetails: TestDiscordMediumDetails = {
          guildId: mediumDetails.guildId,
          channel: mediumDetails.channel,
          webhook: mediumDetails.webhook,
          content: mediumDetails.content,
          embeds: mediumDetails.embeds.map((e) => ({
            ...e,
            title: e.title ?? undefined,
            description: e.description ?? undefined,
            url: e.url ?? undefined,
            color: e.color ?? undefined,
            timestamp: e.timestamp ?? undefined,
            footer: e.footer
              ? { text: e.footer.text, iconUrl: e.footer.iconUrl ?? undefined }
              : undefined,
            author: e.author
              ? {
                  name: e.author.name,
                  url: e.author.url ?? undefined,
                  iconUrl: e.author.iconUrl ?? undefined,
                }
              : undefined,
            thumbnail: e.thumbnail ? { url: e.thumbnail.url } : undefined,
            image: e.image ? { url: e.image.url } : undefined,
            fields: e.fields?.map((f) => ({
              name: f.name,
              value: f.value,
              inline: f.inline ?? undefined,
            })),
          })),
          formatter: mediumDetails.formatter,
          customPlaceholders,
          mentions: mediumDetails.mentions
            ? {
                targets: mediumDetails.mentions.targets?.map((t) => ({
                  id: t.id,
                  type: t.type,
                  filters: t.filters
                    ? { expression: t.filters.expression }
                    : undefined,
                })) as MentionTarget[] | undefined,
              }
            : undefined,
          splitOptions: mediumDetails.splitOptions
            ? {
                splitChar: mediumDetails.splitOptions.splitChar ?? undefined,
                appendChar: mediumDetails.splitOptions.appendChar ?? undefined,
                prependChar:
                  mediumDetails.splitOptions.prependChar ?? undefined,
              }
            : undefined,
          placeholderLimits: mediumDetails.placeholderLimits?.map((pl) => ({
            placeholder: pl.placeholder,
            characterCount: pl.characterCount,
            appendString: pl.appendString ?? undefined,
          })),
          enablePlaceholderFallback: mediumDetails.enablePlaceholderFallback,
          components: mediumDetails.components?.map((row) => ({
            type: row.type,
            components: row.components.map((btn) => ({
              type: btn.type,
              style: btn.style,
              label: btn.label,
              url: btn.url ?? undefined,
              emoji: btn.emoji
                ? {
                    id: btn.emoji.id,
                    name: btn.emoji.name ?? undefined,
                    animated: btn.emoji.animated ?? undefined,
                  }
                : undefined,
            })),
          })),
          componentsV2: mediumDetails.componentsV2 as never,
          forumThreadTitle: mediumDetails.forumThreadTitle,
          forumThreadTags: mediumDetails.forumThreadTags?.map((tag) => ({
            id: tag.id,
            filters: tag.filters
              ? { expression: tag.filters.expression }
              : undefined,
          })) as ForumThreadTag[] | undefined,
          channelNewThreadTitle: mediumDetails.channelNewThreadTitle,
          channelNewThreadExcludesPreview:
            mediumDetails.channelNewThreadExcludesPreview,
        };

        // Deliver test article
        const { result, apiPayload, operationType } = await deliverTestArticle(
          formattedArticle,
          {
            mediumDetails: deliveryMediumDetails,
            filterReferences,
          },
          discordClient
        );

        // Handle delivery result
        if (result.state !== "success") {
          throw new Error(
            `Internal error occurred while delivering test` +
              ` article: (status: ${result.status}, message: ${
                result.message
              }, body: ${JSON.stringify(result.body)}`
          );
        }

        // Map status codes to TestDeliveryStatus
        if (result.status >= 500) {
          return jsonResponse({
            status: TestDeliveryStatus.ThirdPartyInternalError,
            apiPayload,
            operationType,
          });
        } else if (result.status === 401 || result.status === 403) {
          return jsonResponse({
            status: TestDeliveryStatus.MissingApplicationPermission,
            apiPayload,
            operationType,
          });
        } else if (result.status === 400) {
          return jsonResponse({
            status: TestDeliveryStatus.BadPayload,
            apiResponse: result.body,
            apiPayload,
            operationType,
          });
        } else if (result.status === 404) {
          return jsonResponse({
            status: TestDeliveryStatus.MissingChannel,
            apiResponse: result.body,
            apiPayload,
            operationType,
          });
        } else if (result.status === 429) {
          return jsonResponse({
            status: TestDeliveryStatus.TooManyRequests,
            apiPayload,
            operationType,
          });
        } else if (result.status >= 200 && result.status < 300) {
          return jsonResponse({
            status: TestDeliveryStatus.Success,
            apiPayload,
            operationType,
          });
        } else {
          throw new Error(
            `Unhandled Discord API status code when sending test article: ${result.status}`
          );
        }
      } else {
        throw new Error(`Unhandled medium type: ${type}`);
      }
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

      // Handle custom placeholder regex errors
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

      // Handle filters regex errors
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

      // Handle article not found
      if (err instanceof FeedArticleNotFoundException) {
        return jsonResponse({ message: err.message }, 404);
      }

      return handleError(err);
    }
  });
}

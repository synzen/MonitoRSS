/**
 * Handler for POST /v1/user-feeds/preview
 * Creates a preview of Discord message payloads.
 */

import { z } from "zod";
import { withAuth } from "../middleware";
import { jsonResponse, parseJsonBody, handleError } from "../utils";
import { fetchFeedArticle } from "../../feeds/services/articles.service";
import {
  discordMediumPayloadDetailsSchema,
  externalFeedPropertySchema,
  feedV2EventRequestLookupDetails,
} from "../../shared/schemas/feed-v2-event.schema";
import {
  generateDiscordPayloads,
  formatArticleForDiscord,
  CustomPlaceholderStepType,
  type CustomPlaceholder,
} from "../../articles/formatter";
import type { Article } from "../../articles/parser";
import {
  CustomPlaceholderRegexEvalException,
  FiltersRegexEvalException,
} from "../../articles/formatter/exceptions";
import { FeedArticleNotFoundException } from "../../feed-fetcher/exceptions";

enum TestDeliveryMedium {
  Discord = "discord",
}

enum TestDeliveryStatus {
  Success = "SUCCESS",
  NoArticles = "NO_ARTICLES",
}

export async function handlePreview(
  req: Request,
  feedRequestsServiceHost: string
): Promise<Response> {
  return withAuth(req, async () => {
    try {
      const payload = await parseJsonBody<Record<string, unknown>>(req);

      // Parse common fields
      const withType = z
        .object({
          type: z.nativeEnum(TestDeliveryMedium),
          feed: z.object({
            url: z.string(),
            formatOptions: z
              .object({
                dateFormat: z.string().optional(),
                dateTimezone: z.string().optional(),
                dateLocale: z.string().optional(),
              })
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
          article: z.object({
            id: z.string(),
          }),
          includeCustomPlaceholderPreviews: z
            .boolean()
            .optional()
            .default(false),
        })
        .parse(payload);

      const { type, includeCustomPlaceholderPreviews, feed } = withType;

      if (type === TestDeliveryMedium.Discord) {
        // Parse Discord-specific medium details
        const { mediumDetails } = z
          .object({
            mediumDetails: discordMediumPayloadDetailsSchema,
          })
          .parse(payload);

        // Fetch the article
        const article = await fetchFeedArticle(
          withType.feed.url,
          withType.article.id,
          {
            formatOptions: {
              dateFormat: withType.feed.formatOptions?.dateFormat,
              dateTimezone: withType.feed.formatOptions?.dateTimezone,
              disableImageLinkPreviews:
                mediumDetails.formatter?.disableImageLinkPreviews,
              dateLocale: withType.feed.formatOptions?.dateLocale,
            },
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
          }
        );

        if (!article) {
          return jsonResponse({
            status: TestDeliveryStatus.NoArticles,
          });
        }

        // Convert schema custom placeholders to the CustomPlaceholder[] format
        const customPlaceholders: CustomPlaceholder[] | undefined =
          mediumDetails.customPlaceholders?.map((cp) => ({
            id: cp.id,
            referenceName: cp.referenceName,
            sourcePlaceholder: cp.sourcePlaceholder,
            steps: cp.steps.map((step) => {
              // Handle each step type from the discriminated union
              if (step.type === CustomPlaceholderStepType.Regex) {
                return {
                  type: CustomPlaceholderStepType.Regex,
                  regexSearch: step.regexSearch,
                  regexSearchFlags: step.regexSearchFlags ?? undefined,
                  replacementString: step.replacementString ?? undefined,
                };
              }
              if (step.type === CustomPlaceholderStepType.DateFormat) {
                return {
                  type: CustomPlaceholderStepType.DateFormat,
                  format: step.format,
                  timezone: step.timezone ?? undefined,
                  locale: step.locale ?? undefined,
                };
              }
              // UrlEncode, Uppercase, Lowercase only have type
              return { type: step.type };
            }),
          }));

        // Format article for Discord
        const formattedArticle = formatArticleForDiscord(article, {
          ...mediumDetails.formatter,
          customPlaceholders,
        });

        // Generate Discord API payloads
        const payloads = generateDiscordPayloads(formattedArticle, {
          embeds: mediumDetails.embeds?.map((e) => ({
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
          splitOptions: mediumDetails.splitOptions
            ? {
                splitChar: mediumDetails.splitOptions.splitChar ?? undefined,
                appendChar: mediumDetails.splitOptions.appendChar ?? undefined,
                prependChar:
                  mediumDetails.splitOptions.prependChar ?? undefined,
              }
            : undefined,
          content: mediumDetails.content ?? undefined,
          mentions: mediumDetails.mentions
            ? {
                targets: mediumDetails.mentions.targets?.map((t) => ({
                  id: t.id,
                  type: t.type,
                  filters: t.filters
                    ? { expression: t.filters.expression }
                    : undefined,
                })) as any,
              }
            : undefined,
          placeholderLimits: mediumDetails.placeholderLimits?.map((pl) => ({
            placeholder: pl.placeholder,
            characterCount: pl.characterCount,
            appendString: pl.appendString ?? undefined,
          })),
          enablePlaceholderFallback:
            mediumDetails.enablePlaceholderFallback ?? undefined,
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
          componentsV2: mediumDetails.componentsV2?.map((c) => {
            if (c.type === "SEPARATOR") {
              return {
                type: "SEPARATOR" as const,
                divider: c.divider,
                spacing: c.spacing,
              };
            }
            if (c.type === "ACTION_ROW") {
              return {
                type: "ACTION_ROW" as const,
                components: c.components.map((btn) => ({
                  type: "BUTTON" as const,
                  style: btn.style,
                  disabled: btn.disabled,
                  label: btn.label ?? undefined,
                  emoji: btn.emoji
                    ? {
                        id: btn.emoji.id,
                        name: btn.emoji.name ?? undefined,
                        animated: btn.emoji.animated ?? undefined,
                      }
                    : undefined,
                  url: btn.url ?? undefined,
                })),
              };
            }
            // Handle other component types as-is
            return c as any;
          }),
          customPlaceholders,
        });

        // Clean up empty embed fields
        const cleanedPayloads = payloads.map((p) => ({
          ...p,
          embeds: p?.embeds?.map((embed) => ({
            ...embed,
            author: !embed.author?.name ? undefined : embed.author,
            footer: !embed.footer?.text ? undefined : embed.footer,
            thumbnail: !embed.thumbnail?.url ? undefined : embed.thumbnail,
            image: !embed.image?.url ? undefined : embed.image,
            fields: embed?.fields
              ?.map((field) =>
                !field.name || !field.value ? undefined : field
              )
              ?.filter((field) => field !== undefined),
          })),
        }));

        return jsonResponse({
          status: TestDeliveryStatus.Success,
          messages: cleanedPayloads,
        });
      } else {
        throw new Error(`Unhandled medium type: ${type}`);
      }
    } catch (err) {
      // Handle Zod validation errors
      if (err instanceof z.ZodError) {
        return jsonResponse(
          err.issues.map((issue: z.ZodIssue) => ({
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

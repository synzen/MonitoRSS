import { Injectable } from "@nestjs/common";
import dayjs from "dayjs";
import { Article } from "../../../../shared";
import { ArticleFormatterService } from "../../../../article-formatter/article-formatter.service";
import { ArticleFiltersService } from "../../../../article-filters/article-filters.service";
import {
  FilterExpressionReference,
  LogicalExpression,
} from "../../../../article-filters/types";
import { DeliveryDetails, DiscordMessageApiPayload } from "../../../types";
import { replaceTemplateString } from "../../../../articles/utils/replace-template-string";

export interface GenerateApiPayloadsOptions {
  embeds: DeliveryDetails["deliverySettings"]["embeds"];
  content?: string;
  splitOptions?: DeliveryDetails["deliverySettings"]["splitOptions"] & {
    limit?: number;
  };
  mentions: DeliveryDetails["deliverySettings"]["mentions"];
  filterReferences: FilterExpressionReference;
  placeholderLimits: DeliveryDetails["deliverySettings"]["placeholderLimits"];
  enablePlaceholderFallback: boolean;
  components: DeliveryDetails["deliverySettings"]["components"];
}

export interface GenerateApiTextPayloadOptions {
  content: string | undefined;
  limit?: number;
  filterReferences: FilterExpressionReference;
  mentions: DeliveryDetails["deliverySettings"]["mentions"];
  placeholderLimits: DeliveryDetails["deliverySettings"]["placeholderLimits"];
  enablePlaceholderFallback: boolean;
  components: DeliveryDetails["deliverySettings"]["components"];
}

interface ReplacePlaceholdersOptions {
  filterReferences: FilterExpressionReference;
  mentions: DeliveryDetails["deliverySettings"]["mentions"];
  placeholderLimits: DeliveryDetails["deliverySettings"]["placeholderLimits"];
  enablePlaceholderFallback: boolean;
  encodeUrl?: boolean;
}

@Injectable()
export class DiscordPayloadBuilderService {
  constructor(
    private readonly articleFormatterService: ArticleFormatterService,
    private readonly articleFiltersService: ArticleFiltersService
  ) {}

  getForumTagsToSend(
    inputTags: DeliveryDetails["deliverySettings"]["forumThreadTags"],
    filterReferences: FilterExpressionReference
  ): string[] {
    if (!inputTags) {
      return [];
    }

    const results = inputTags.map(({ filters, id }) => {
      if (!filters) {
        return id;
      }

      const { result } = this.articleFiltersService.getArticleFilterResults(
        filters.expression as never,
        filterReferences
      );

      return result ? id : null;
    });

    return results.filter((result) => !!result) as string[];
  }

  generateApiTextPayload<T extends string | undefined>(
    article: Article,
    options: GenerateApiTextPayloadOptions
  ): T {
    const {
      content,
      limit,
      filterReferences,
      mentions,
      placeholderLimits,
      enablePlaceholderFallback,
      components,
    } = options;

    const payloads = this.generateApiPayloads(article, {
      embeds: [],
      content,
      splitOptions: {
        limit,
      },
      filterReferences,
      mentions,
      placeholderLimits,
      enablePlaceholderFallback,
      components,
    });

    return (payloads[0].content || undefined) as T;
  }

  generateApiPayloads(
    article: Article,
    options: GenerateApiPayloadsOptions
  ): DiscordMessageApiPayload[] {
    const {
      embeds,
      content,
      splitOptions,
      mentions,
      filterReferences,
      placeholderLimits,
      enablePlaceholderFallback,
      components,
    } = options;

    const payloadContent = this.articleFormatterService.applySplit(
      this.replacePlaceholdersInString(article, content, {
        mentions,
        filterReferences,
        placeholderLimits,
        enablePlaceholderFallback,
      }),
      {
        ...splitOptions,
        isEnabled: !!splitOptions,
      }
    );

    const replacePlaceholderStringArgs: ReplacePlaceholdersOptions = {
      mentions,
      filterReferences,
      placeholderLimits,
      enablePlaceholderFallback,
    };

    const payloads: DiscordMessageApiPayload[] = payloadContent.map(
      (contentPart) => ({
        content: contentPart,
        embeds: [],
      })
    );

    payloads[payloads.length - 1].embeds = (embeds || [])
      ?.map((embed) => {
        let timestamp: string | undefined = undefined;

        if (embed.timestamp === "now") {
          timestamp = new Date().toISOString();
        } else if (embed.timestamp === "article" && article.raw.date) {
          const dayjsDate = dayjs(article.raw.date);

          if (dayjsDate.isValid()) {
            timestamp = dayjsDate.toISOString();
          }
        }

        const embedTitle = this.articleFormatterService.applySplit(
          this.replacePlaceholdersInString(
            article,
            embed.title,
            replacePlaceholderStringArgs
          ),
          {
            limit: 256,
          }
        )[0];

        const embedUrl =
          this.replacePlaceholdersInString(article, embed.url, {
            ...replacePlaceholderStringArgs,
            encodeUrl: true,
          }) || null;

        const embedDescription = this.articleFormatterService.applySplit(
          this.replacePlaceholdersInString(
            article,
            embed.description,
            replacePlaceholderStringArgs
          ),
          {
            limit: 4096,
          }
        )[0];

        const embedFields = (embed.fields || [])
          ?.filter((field) => field.name && field.value)
          .map((field) => ({
            name: this.articleFormatterService.applySplit(
              this.replacePlaceholdersInString(
                article,
                field.name,
                replacePlaceholderStringArgs
              ),
              {
                limit: 256,
              }
            )[0],
            value: this.articleFormatterService.applySplit(
              this.replacePlaceholdersInString(
                article,
                field.value,
                replacePlaceholderStringArgs
              ),
              {
                limit: 1024,
              }
            )[0],
            inline: field.inline,
          }));

        const embedFooter = !embed.footer?.text
          ? undefined
          : {
              text: this.articleFormatterService.applySplit(
                this.replacePlaceholdersInString(
                  article,
                  embed.footer.text,
                  replacePlaceholderStringArgs
                ),
                {
                  limit: 2048,
                }
              )[0],
              icon_url:
                this.replacePlaceholdersInString(
                  article,
                  embed.footer.iconUrl,
                  { ...replacePlaceholderStringArgs, encodeUrl: true }
                ) || null,
            };

        const embedImage = !embed.image?.url
          ? undefined
          : {
              url: this.replacePlaceholdersInString(article, embed.image.url, {
                ...replacePlaceholderStringArgs,
                encodeUrl: true,
              }) as string,
            };

        const embedThumbnail = !embed.thumbnail?.url
          ? undefined
          : {
              url: this.replacePlaceholdersInString(
                article,
                embed.thumbnail.url,
                { ...replacePlaceholderStringArgs, encodeUrl: true }
              ) as string,
            };

        const embedAuthor = !embed.author?.name
          ? undefined
          : {
              name: this.articleFormatterService.applySplit(
                this.replacePlaceholdersInString(
                  article,
                  embed.author.name,
                  replacePlaceholderStringArgs
                ),
                {
                  limit: 256,
                }
              )[0],
              url: this.replacePlaceholdersInString(article, embed.author.url, {
                ...replacePlaceholderStringArgs,
                encodeUrl: true,
              }),
              icon_url:
                this.replacePlaceholdersInString(
                  article,
                  embed.author.iconUrl,
                  replacePlaceholderStringArgs
                ) || null,
            };

        return {
          title: embedTitle,
          description: embedDescription,
          author: embedAuthor,
          color: embed.color,
          footer: embedFooter,
          image: embedImage,
          thumbnail: embedThumbnail,
          url: embedUrl,
          fields: embedFields,
          timestamp,
        };
      })
      // Discord only allows 10 embeds per message
      .slice(0, 10);

    if (components && payloads.length > 0) {
      payloads[payloads.length - 1].components = components.map(
        ({ type, components: nestedComponents }) => ({
          type,
          components: nestedComponents.map(({ style, type, label, url }) => {
            return {
              style,
              type,
              label: (
                this.replacePlaceholdersInString(
                  article,
                  label,
                  replacePlaceholderStringArgs
                ) || label
              ).slice(0, 80),
              url: this.replacePlaceholdersInString(article, url, {
                ...replacePlaceholderStringArgs,
                encodeUrl: true,
              }),
            };
          }),
        })
      );
    }

    return payloads;
  }

  replacePlaceholdersInString(
    article: Article,
    str: string | undefined | null,
    options: ReplacePlaceholdersOptions
  ): string {
    const {
      filterReferences,
      mentions: inputMentions,
      placeholderLimits,
      enablePlaceholderFallback,
      encodeUrl,
    } = options;

    const referenceObject = {
      ...article.flattened,
    };

    if (inputMentions) {
      const mentions =
        inputMentions.targets
          ?.map((mention) => {
            if (mention.filters?.expression) {
              const { result } =
                this.articleFiltersService.getArticleFilterResults(
                  mention.filters.expression as unknown as LogicalExpression,
                  filterReferences
                );

              if (!result) {
                return null;
              }
            }

            if (mention.type === "role") {
              return `<@&${mention.id}>`;
            } else if (mention.type === "user") {
              return `<@${mention.id}>`;
            }
          })
          ?.filter((s) => s)
          ?.join(" ") || "";

      referenceObject["discord::mentions"] = mentions;
    }

    let value =
      replaceTemplateString(referenceObject, str, {
        supportFallbacks: enablePlaceholderFallback,
        split: {
          func: (str, { limit, appendString }) => {
            return this.articleFormatterService.applySplit(str, {
              appendChar: appendString,
              limit,
              isEnabled: true,
              includeAppendInFirstPart: true,
            })[0];
          },
          limits: placeholderLimits?.map((r) => ({
            key: r.placeholder,
            ...r,
          })),
        },
      }) || "";

    if (encodeUrl) {
      value = value.replace(/\s/g, "%20");
    }

    return value;
  }

  /**
   * Enhances payloads with webhook username and avatar_url fields.
   */
  enhancePayloadsWithWebhookDetails(
    article: Article,
    payloads: DiscordMessageApiPayload[],
    webhookName: string | undefined,
    webhookIconUrl: string | undefined,
    options: Omit<GenerateApiTextPayloadOptions, "content" | "limit">
  ): DiscordMessageApiPayload[] {
    return payloads.map((payload) => ({
      ...payload,
      username: this.generateApiTextPayload(article, {
        content: webhookName,
        limit: 256,
        ...options,
      }),
      avatar_url: this.generateApiTextPayload(article, {
        content: webhookIconUrl,
        ...options,
      }),
    }));
  }

  /**
   * Generates a thread name from a title template, with fallback to "New Article".
   */
  generateThreadName(
    article: Article,
    titleTemplate: string | null | undefined,
    options: Omit<GenerateApiTextPayloadOptions, "content" | "limit">
  ): string {
    return (
      this.generateApiTextPayload(article, {
        content: titleTemplate || "{{title}}",
        limit: 100,
        ...options,
      }) || "New Article"
    );
  }

  /**
   * Builds a forum thread body for either channel or webhook forum.
   */
  buildForumThreadBody(options: {
    isWebhook: boolean;
    threadName: string;
    firstPayload: DiscordMessageApiPayload;
    tags: string[];
  }): Record<string, unknown> {
    const { isWebhook, threadName, firstPayload, tags } = options;

    if (isWebhook) {
      return {
        ...firstPayload,
        thread_name: threadName,
        applied_tags: tags,
      };
    }

    return {
      name: threadName,
      message: firstPayload,
      applied_tags: tags,
      type: 11,
    };
  }
}

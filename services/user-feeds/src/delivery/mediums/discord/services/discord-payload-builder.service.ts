import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import dayjs from "dayjs";
import {
  Article,
  DiscordComponentType,
  DISCORD_COMPONENT_TYPE_TO_NUMBER,
  ButtonV2,
  SectionV2,
  ActionRowV2,
  SeparatorV2,
  ContainerV2,
} from "../../../../shared";
import { ArticleFormatterService } from "../../../../article-formatter/article-formatter.service";
import { ArticleFiltersService } from "../../../../article-filters/article-filters.service";
import {
  FilterExpressionReference,
  LogicalExpression,
} from "../../../../article-filters/types";
import {
  DeliveryDetails,
  DiscordMessageApiPayload,
  DiscordMessageComponentV2,
  DiscordSectionV2,
  DiscordActionRowV2,
  DiscordSeparatorV2,
  DiscordContainerV2,
  DISCORD_COMPONENTS_V2_FLAG,
} from "../../../types";
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
  componentsV2: DeliveryDetails["deliverySettings"]["componentsV2"];
}

export interface GenerateApiTextPayloadOptions {
  content: string | undefined;
  limit?: number;
  filterReferences: FilterExpressionReference;
  mentions: DeliveryDetails["deliverySettings"]["mentions"];
  placeholderLimits: DeliveryDetails["deliverySettings"]["placeholderLimits"];
  enablePlaceholderFallback: boolean;
  components: DeliveryDetails["deliverySettings"]["components"];
  componentsV2: DeliveryDetails["deliverySettings"]["componentsV2"];
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
      componentsV2,
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
      componentsV2,
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
      componentsV2,
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

    // V2 components take precedence over V1 - they cannot be mixed
    // V2 components also cannot have content field set
    if (componentsV2 && componentsV2.length > 0 && payloads.length > 0) {
      const lastPayload = payloads[payloads.length - 1];
      lastPayload.flags = DISCORD_COMPONENTS_V2_FLAG;
      lastPayload.components = this.buildComponentsV2(
        article,
        componentsV2,
        replacePlaceholderStringArgs
      );
      delete lastPayload.content;
    } else if (components && payloads.length > 0) {
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

  /**
   * Builds V2 components with placeholder replacement.
   * V2 components use a different structure than V1 and require
   * the IS_COMPONENTS_V2 flag (32768) to be set on the message.
   */
  private buildComponentsV2(
    article: Article,
    componentsV2: NonNullable<
      DeliveryDetails["deliverySettings"]["componentsV2"]
    >,
    replacePlaceholderOptions: ReplacePlaceholdersOptions
  ): DiscordMessageComponentV2[] {
    return componentsV2.map((component) => {
      if (component.type === DiscordComponentType.ActionRowV2) {
        return this.buildActionRowV2(
          article,
          component,
          replacePlaceholderOptions
        );
      }

      if (component.type === DiscordComponentType.SeparatorV2) {
        return this.buildSeparatorV2(component);
      }

      if (component.type === DiscordComponentType.ContainerV2) {
        return this.buildContainerV2(
          article,
          component,
          replacePlaceholderOptions
        );
      }

      // Section component
      return this.buildSectionV2(article, component, replacePlaceholderOptions);
    });
  }

  /**
   * Builds a V2 Section component.
   */
  private buildSectionV2(
    article: Article,
    section: SectionV2,
    replacePlaceholderOptions: ReplacePlaceholdersOptions
  ): DiscordSectionV2 {
    // Process section child components (text displays only)
    const components = section.components.map((child) => ({
      type: DISCORD_COMPONENT_TYPE_TO_NUMBER[DiscordComponentType.TextDisplay],
      content: this.replacePlaceholdersInString(
        article,
        child.content,
        replacePlaceholderOptions
      ),
    }));

    // Process accessory (button or thumbnail)
    const accessory = this.buildAccessoryV2(
      article,
      section.accessory,
      replacePlaceholderOptions
    );

    return {
      type: DISCORD_COMPONENT_TYPE_TO_NUMBER[DiscordComponentType.Section],
      components,
      accessory,
    };
  }

  /**
   * Builds a V2 Action Row component with buttons.
   */
  private buildActionRowV2(
    article: Article,
    actionRow: ActionRowV2,
    replacePlaceholderOptions: ReplacePlaceholdersOptions
  ): DiscordActionRowV2 {
    const buttons = actionRow.components.map((button) =>
      this.buildButtonV2(article, button, replacePlaceholderOptions)
    );

    return {
      type: DISCORD_COMPONENT_TYPE_TO_NUMBER[DiscordComponentType.ActionRowV2],
      components: buttons,
    };
  }

  /**
   * Builds a V2 Separator component.
   */
  private buildSeparatorV2(separator: SeparatorV2): DiscordSeparatorV2 {
    return {
      type: DISCORD_COMPONENT_TYPE_TO_NUMBER[DiscordComponentType.SeparatorV2],
      divider: separator.divider,
      spacing: separator.spacing,
    };
  }

  /**
   * Builds a V2 Container component.
   * Containers group components visually with an optional accent color bar.
   */
  private buildContainerV2(
    _article: Article,
    container: ContainerV2,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _replacePlaceholderOptions: ReplacePlaceholdersOptions
  ): DiscordContainerV2 {
    // Build child components (currently only separators are supported)
    const components = container.components.map((child) => {
      // Currently only separators are supported in containers
      return this.buildSeparatorV2(child as SeparatorV2);
    });

    return {
      type: DISCORD_COMPONENT_TYPE_TO_NUMBER[DiscordComponentType.ContainerV2],
      accent_color: container.accent_color ?? undefined,
      spoiler: container.spoiler,
      components,
    };
  }

  /**
   * Builds a V2 Button component.
   */
  private buildButtonV2(
    article: Article,
    button: ButtonV2,
    replacePlaceholderOptions: ReplacePlaceholdersOptions
  ) {
    return {
      type: DISCORD_COMPONENT_TYPE_TO_NUMBER[DiscordComponentType.ButtonV2],
      custom_id: randomUUID(),
      style: button.style,
      label: button.label
        ? this.replacePlaceholdersInString(
            article,
            button.label,
            replacePlaceholderOptions
          ).slice(0, 80)
        : undefined,
      emoji: button.emoji,
      url: button.url
        ? this.replacePlaceholdersInString(article, button.url, {
            ...replacePlaceholderOptions,
            encodeUrl: true,
          })
        : undefined,
      disabled: button.disabled,
    };
  }

  /**
   * Builds a V2 accessory component (button or thumbnail).
   */
  private buildAccessoryV2(
    article: Article,
    accessory: SectionV2["accessory"],
    replacePlaceholderOptions: ReplacePlaceholdersOptions
  ): DiscordSectionV2["accessory"] {
    if (accessory.type === DiscordComponentType.Thumbnail) {
      return {
        type: DISCORD_COMPONENT_TYPE_TO_NUMBER[DiscordComponentType.Thumbnail],
        media: {
          url: this.replacePlaceholdersInString(article, accessory.media.url, {
            ...replacePlaceholderOptions,
            encodeUrl: true,
          }),
        },
        description: accessory.description
          ? this.replacePlaceholdersInString(
              article,
              accessory.description,
              replacePlaceholderOptions
            ).slice(0, 1024)
          : undefined,
        spoiler: accessory.spoiler,
      };
    }

    // Button accessory
    return {
      type: DISCORD_COMPONENT_TYPE_TO_NUMBER[DiscordComponentType.ButtonV2],
      custom_id: randomUUID(),
      style: accessory.style,
      label: accessory.label
        ? this.replacePlaceholdersInString(
            article,
            accessory.label,
            replacePlaceholderOptions
          ).slice(0, 80)
        : undefined,
      emoji: accessory.emoji,
      url: accessory.url
        ? this.replacePlaceholdersInString(article, accessory.url, {
            ...replacePlaceholderOptions,
            encodeUrl: true,
          })
        : undefined,
      disabled: accessory.disabled,
    };
  }
}

import dayjs from "dayjs";
import type { Article } from "../../articles/parser";
import { getArticleFilterResults } from "../../articles/filters";
import { replaceTemplateString, generateText } from "../../formatting";
import { applySplit, truncateText } from "../../formatting";
import { processCustomPlaceholders } from "../../formatting";
import type { PlaceholderLimit, CustomPlaceholder } from "../../formatting";
import {
  DiscordComponentType,
  DISCORD_COMPONENT_TYPE_TO_NUMBER,
  DISCORD_COMPONENTS_V2_FLAG,
  type DiscordMessageApiPayload,
  type DiscordMessageComponent,
  type DiscordMessageComponentV2,
  type DiscordTextDisplayV2,
  type DiscordThumbnailV2,
  type DiscordButtonV2,
  type DiscordSectionV2,
  type DiscordActionRowV2,
  type DiscordSeparatorV2,
  type DiscordMediaGalleryV2,
  type DiscordContainerV2,
  type ButtonInput,
  type ActionRowInput,
  type TextDisplayV2Input,
  type ThumbnailV2Input,
  type ButtonV2Input,
  type SectionV2Input,
  type ActionRowV2Input,
  type SeparatorV2Input,
  type MediaGalleryV2Input,
  type ContainerV2Input,
  type ContainerChildV2Input,
  type ComponentV2Input,
  type GeneratePayloadsOptions,
  type ForumThreadTag,
  type WebhookPayload,
} from "./formatting-types";

// ============================================================================
// Placeholder Replacement Context
// ============================================================================

interface ReplacePlaceholderContext {
  flattened: Record<string, string | undefined>;
  replaceOptions: {
    supportFallbacks?: boolean;
    split?: {
      func: (
        str: string,
        options: { appendString?: string | null; limit: number }
      ) => string;
      limits?: PlaceholderLimit[] | null;
    };
  };
}

// ============================================================================
// V2 Component Builders
// ============================================================================

function buildButtonV2(
  button: ButtonV2Input,
  ctx: ReplacePlaceholderContext
): DiscordButtonV2 {
  const isLinkButton = button.style === 5 && button.url;

  return {
    type: DISCORD_COMPONENT_TYPE_TO_NUMBER[DiscordComponentType.ButtonV2],
    ...(isLinkButton ? {} : { custom_id: crypto.randomUUID() }),
    style: button.style,
    label: button.label
      ? truncateText(
          replaceTemplateString(
            ctx.flattened,
            button.label,
            ctx.replaceOptions
          ),
          80
        )
      : undefined,
    emoji: button.emoji,
    url: button.url
      ? replaceTemplateString(
          ctx.flattened,
          button.url,
          ctx.replaceOptions
        )?.replace(/\s/g, "%20")
      : undefined,
    disabled: button.disabled,
  };
}

function buildThumbnailV2(
  thumbnail: ThumbnailV2Input,
  ctx: ReplacePlaceholderContext
): DiscordThumbnailV2 {
  return {
    type: DISCORD_COMPONENT_TYPE_TO_NUMBER[DiscordComponentType.Thumbnail],
    media: {
      url:
        replaceTemplateString(
          ctx.flattened,
          thumbnail.media.url,
          ctx.replaceOptions
        )?.replace(/\s/g, "%20") || "",
    },
    description: thumbnail.description
      ? truncateText(
          replaceTemplateString(
            ctx.flattened,
            thumbnail.description,
            ctx.replaceOptions
          ),
          1024
        )
      : undefined,
    spoiler: thumbnail.spoiler,
  };
}

function buildTextDisplayV2(
  textDisplay: TextDisplayV2Input,
  ctx: ReplacePlaceholderContext
): DiscordTextDisplayV2 {
  return {
    type: DISCORD_COMPONENT_TYPE_TO_NUMBER[DiscordComponentType.TextDisplay],
    content:
      replaceTemplateString(
        ctx.flattened,
        textDisplay.content,
        ctx.replaceOptions
      )?.trim() || "",
  };
}

function buildSectionV2(
  section: SectionV2Input,
  ctx: ReplacePlaceholderContext
): DiscordSectionV2 {
  const components = section.components.map((child) =>
    buildTextDisplayV2(child, ctx)
  );

  const accessory =
    section.accessory.type === "THUMBNAIL"
      ? buildThumbnailV2(section.accessory, ctx)
      : buildButtonV2(section.accessory, ctx);

  return {
    type: DISCORD_COMPONENT_TYPE_TO_NUMBER[DiscordComponentType.Section],
    components,
    accessory,
  };
}

function buildActionRowV2(
  actionRow: ActionRowV2Input,
  ctx: ReplacePlaceholderContext
): DiscordActionRowV2 {
  const buttons = actionRow.components.map((button) =>
    buildButtonV2(button, ctx)
  );

  return {
    type: DISCORD_COMPONENT_TYPE_TO_NUMBER[DiscordComponentType.ActionRowV2],
    components: buttons,
  };
}

function buildSeparatorV2(separator: SeparatorV2Input): DiscordSeparatorV2 {
  return {
    type: DISCORD_COMPONENT_TYPE_TO_NUMBER[DiscordComponentType.SeparatorV2],
    divider: separator.divider,
    spacing: separator.spacing,
  };
}

function buildMediaGalleryV2(
  mediaGallery: MediaGalleryV2Input,
  ctx: ReplacePlaceholderContext
): DiscordMediaGalleryV2 {
  const items = mediaGallery.items.map((item) => ({
    media: {
      url:
        replaceTemplateString(
          ctx.flattened,
          item.media.url,
          ctx.replaceOptions
        )?.replace(/\s/g, "%20") || "",
    },
    description: item.description
      ? truncateText(
          replaceTemplateString(
            ctx.flattened,
            item.description,
            ctx.replaceOptions
          ),
          1024
        )
      : undefined,
    spoiler: item.spoiler,
  })).filter((item) => !!item.media.url);

  return {
    type: DISCORD_COMPONENT_TYPE_TO_NUMBER[DiscordComponentType.MediaGalleryV2],
    items,
  };
}

function buildContainerChildV2(
  child: ContainerChildV2Input,
  ctx: ReplacePlaceholderContext
): DiscordMessageComponentV2 | null {
  switch (child.type) {
    case "SEPARATOR":
      return buildSeparatorV2(child);
    case "ACTION_ROW":
      return buildActionRowV2(child, ctx);
    case "SECTION":
      return buildSectionV2(child, ctx);
    case "TEXT_DISPLAY":
      return buildTextDisplayV2(
        child,
        ctx
      ) as unknown as DiscordMessageComponentV2;
    case "MEDIA_GALLERY": {
      const gallery = buildMediaGalleryV2(child, ctx);

      if (gallery.items.length === 0) {
        return null;
      }

      return gallery;
    } default:
      throw new Error(
        `Unknown container child type: ${(child as { type: string }).type}`
      );
  }
}

function buildContainerV2(
  container: ContainerV2Input,
  ctx: ReplacePlaceholderContext
): DiscordContainerV2 {
  const components = container.components.map((child) =>
    buildContainerChildV2(child, ctx)
  ).filter((c): c is DiscordMessageComponentV2 => c !== null);

  return {
    type: DISCORD_COMPONENT_TYPE_TO_NUMBER[DiscordComponentType.ContainerV2],
    accent_color: container.accent_color ?? undefined,
    spoiler: container.spoiler,
    components,
  };
}

function buildComponentsV2(
  componentsV2: ComponentV2Input[],
  ctx: ReplacePlaceholderContext
): DiscordMessageComponentV2[] {
  return componentsV2.map((component) => {
    switch (component.type) {
      case "ACTION_ROW":
        return buildActionRowV2(component, ctx);
      case "SEPARATOR":
        return buildSeparatorV2(component);
      case "CONTAINER":
        return buildContainerV2(component, ctx);
      case "SECTION":
        return buildSectionV2(component, ctx);
      default:
        throw new Error(
          `Unknown V2 component type: ${(component as { type: string }).type}`
        );
    }
  });
}

// ============================================================================
// V1 Component Builders
// ============================================================================

function buildComponentsV1(
  components: ActionRowInput[],
  ctx: ReplacePlaceholderContext
): DiscordMessageComponent[] {
  return components.map(({ type, components: buttons }) => ({
    type,
    components: buttons.map(({ style, type, label, url, emoji }) => ({
      style,
      type,
      label: truncateText(
        replaceTemplateString(ctx.flattened, label, ctx.replaceOptions) ||
          label,
        80
      ),
      url: url
        ? replaceTemplateString(
            ctx.flattened,
            url,
            ctx.replaceOptions
          )?.replace(/\s/g, "%20")
        : undefined,
      emoji,
    })),
  }));
}

// ============================================================================
// Payload Generation
// ============================================================================

export function generateDiscordPayloads(
  article: Article,
  options: GeneratePayloadsOptions
): DiscordMessageApiPayload[] {
  const flattened = { ...article.flattened };

  if (options.mentions?.targets?.length) {
    const mentions = options.mentions.targets
      .filter((m) => {
        if (!m.filters) return true;
        return getArticleFilterResults(m.filters.expression, article).result;
      })
      .map((m) => (m.type === "role" ? `<@&${m.id}>` : `<@${m.id}>`))
      .join(" ");
    flattened["discord::mentions"] = mentions;
  }

  const replaceOptions = {
    supportFallbacks: options.enablePlaceholderFallback,
    split: options.placeholderLimits
      ? {
          func: (
            str: string,
            opts: { appendString?: string | null; limit: number }
          ) => {
            return applySplit(str, {
              appendChar: opts.appendString ?? undefined,
              limit: opts.limit,
              isEnabled: true,
              includeAppendInFirstPart: true,
            })[0] || ""
          },
          limits: options.placeholderLimits,
        }
      : undefined,
  };

  const ctx: ReplacePlaceholderContext = {
    flattened,
    replaceOptions,
  };

  if (options.componentsV2?.length) {
    return [
      {
        flags: DISCORD_COMPONENTS_V2_FLAG,
        components: buildComponentsV2(options.componentsV2, ctx),
      },
    ];
  }

  const contentTemplate = replaceTemplateString(
    flattened,
    options.content,
    replaceOptions
  );
  const contentParts = applySplit(contentTemplate, {
    ...options.splitOptions,
    isEnabled: !!options.splitOptions,
  });

  const payloads: DiscordMessageApiPayload[] = contentParts.map((content) => ({
    content: content || undefined,
    embeds: [],
  }));

  if (options.embeds?.length) {
    const processedEmbeds = options.embeds
      .map((embed) => {
        const title = truncateText(
          replaceTemplateString(flattened, embed.title, replaceOptions),
          256
        );
        const description = truncateText(
          replaceTemplateString(flattened, embed.description, replaceOptions),
          4096
        );
        const url = replaceTemplateString(flattened, embed.url, replaceOptions);

        if (
          !title &&
          !description &&
          !url &&
          !embed.image?.url &&
          !embed.thumbnail?.url
        ) {
          return null;
        }

        const result: DiscordMessageApiPayload["embeds"] extends
          | (infer T)[]
          | undefined
          ? T
          : never = {
          color: embed.color,
        };

        if (title) result.title = title;
        if (description) result.description = description;
        if (url) result.url = url.replace(/\s/g, "%20");

        if (embed.footer?.text) {
          result.footer = {
            text: truncateText(
              replaceTemplateString(
                flattened,
                embed.footer.text,
                replaceOptions
              ),
              2048
            ),
          };
          if (embed.footer.iconUrl) {
            const iconUrl = replaceTemplateString(
              flattened,
              embed.footer.iconUrl,
              replaceOptions
            );
            if (iconUrl) result.footer.icon_url = iconUrl.replace(/\s/g, "%20");
          }
        }

        if (embed.image?.url) {
          const imageUrl = replaceTemplateString(
            flattened,
            embed.image.url,
            replaceOptions
          );
          if (imageUrl) result.image = { url: imageUrl.replace(/\s/g, "%20") };
        }

        if (embed.thumbnail?.url) {
          const thumbUrl = replaceTemplateString(
            flattened,
            embed.thumbnail.url,
            replaceOptions
          );
          if (thumbUrl)
            result.thumbnail = { url: thumbUrl.replace(/\s/g, "%20") };
        }

        if (embed.author?.name) {
          result.author = {
            name: truncateText(
              replaceTemplateString(
                flattened,
                embed.author.name,
                replaceOptions
              ),
              256
            ),
          };
          if (embed.author.url) {
            const authorUrl = replaceTemplateString(
              flattened,
              embed.author.url,
              replaceOptions
            );
            if (authorUrl) result.author.url = authorUrl.replace(/\s/g, "%20");
          }
          if (embed.author.iconUrl) {
            const iconUrl = replaceTemplateString(
              flattened,
              embed.author.iconUrl,
              replaceOptions
            );
            if (iconUrl) result.author.icon_url = iconUrl.replace(/\s/g, "%20");
          }
        }

        if (embed.fields?.length) {
          result.fields = embed.fields
            .map((field) => ({
              name: truncateText(
                replaceTemplateString(flattened, field.name, replaceOptions),
                256
              ),
              value: truncateText(
                replaceTemplateString(flattened, field.value, replaceOptions),
                1024
              ),
              inline: field.inline,
            }))
            .filter((f) => f.name && f.value);
        }

        if (embed.timestamp === "now") {
          result.timestamp = new Date().toISOString();
        } else if (embed.timestamp === "article" && article.raw.date) {
          const date = dayjs(article.raw.date);
          if (date.isValid()) {
            result.timestamp = date.toISOString();
          }
        }

        return result;
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .slice(0, 10);

    if (processedEmbeds.length > 0) {
      payloads[payloads.length - 1]!.embeds = processedEmbeds;
    }
  }

  if (options.components?.length && payloads.length > 0) {
    payloads[payloads.length - 1]!.components = buildComponentsV1(
      options.components,
      ctx
    );
  }

  return payloads.filter(
    (p) =>
      p.content ||
      (p.embeds && p.embeds.length > 0) ||
      (p.components && p.components.length > 0)
  );
}

// ============================================================================
// Forum Thread and Webhook Helpers
// ============================================================================

export function getForumTagsToSend(
  tags: ForumThreadTag[] | undefined | null,
  article: Article
): string[] {
  if (!tags?.length) return [];

  return tags
    .filter((tag) => {
      if (!tag.filters) return true;
      return getArticleFilterResults(tag.filters.expression, article).result;
    })
    .map((tag) => tag.id);
}

export function generateThreadName(
  article: Article,
  titleTemplate: string | null | undefined,
  options: {
    enablePlaceholderFallback?: boolean;
    customPlaceholders?: CustomPlaceholder[];
  }
): string {
  let flattened = { ...article.flattened };

  if (options.customPlaceholders?.length) {
    const result = processCustomPlaceholders(
      flattened,
      options.customPlaceholders
    );
    flattened = result.flattened;
  }

  return (
    generateText({
      content: titleTemplate || "{{title}}",
      limit: 100,
      flattened,
      enablePlaceholderFallback: options.enablePlaceholderFallback,
    }) || "New Article"
  );
}

export function buildForumThreadBody(options: {
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
    type: 11, // GUILD_PUBLIC_THREAD
  };
}

export function enhancePayloadsWithWebhookDetails(
  article: Article,
  payloads: DiscordMessageApiPayload[],
  webhookName: string | undefined,
  webhookIconUrl: string | undefined,
  options: {
    enablePlaceholderFallback?: boolean;
    customPlaceholders?: CustomPlaceholder[];
  }
): WebhookPayload[] {
  let flattened = { ...article.flattened };

  if (options.customPlaceholders?.length) {
    const result = processCustomPlaceholders(
      flattened,
      options.customPlaceholders
    );
    flattened = result.flattened;
  }

  return payloads.map((payload) => ({
    ...payload,
    username: generateText({
      content: webhookName,
      limit: 256,
      flattened,
      enablePlaceholderFallback: options.enablePlaceholderFallback,
    }),
    avatar_url: generateText({
      content: webhookIconUrl,
      flattened,
      enablePlaceholderFallback: options.enablePlaceholderFallback,
    }),
  }));
}

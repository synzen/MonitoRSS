import { CreateTemplatePreviewInput } from "../../../feedConnections/api";
import {
  ComponentType,
  MessageComponentRoot,
  V2MessageComponentRoot,
  LegacyEmbedComponent,
  SectionComponent,
  ActionRowComponent,
  DividerComponent,
  ContainerComponent,
  TextDisplayComponent,
  MediaGalleryComponent,
  MediaGalleryItemComponent,
  ButtonComponent,
  ThumbnailComponent,
  LegacyTextComponent,
} from "../../../../pages/MessageBuilder/types";
import { DiscordButtonStyle } from "../../../../pages/MessageBuilder/constants/DiscordButtonStyle";

const V2_COMPONENT_TYPE = {
  ActionRow: "ACTION_ROW",
  Button: "BUTTON",
  Section: "SECTION",
  TextDisplay: "TEXT_DISPLAY",
  Thumbnail: "THUMBNAIL",
  Separator: "SEPARATOR",
  Container: "CONTAINER",
  MediaGallery: "MEDIA_GALLERY",
} as const;

const getButtonStyleNumber = (style: DiscordButtonStyle): number => {
  switch (style) {
    case DiscordButtonStyle.Primary:
      return 1;
    case DiscordButtonStyle.Secondary:
      return 2;
    case DiscordButtonStyle.Success:
      return 3;
    case DiscordButtonStyle.Danger:
      return 4;
    case DiscordButtonStyle.Link:
      return 5;
    default:
      return 1;
  }
};

const convertV2ButtonToAPI = (button: ButtonComponent) => ({
  type: V2_COMPONENT_TYPE.Button,
  style: getButtonStyleNumber(button.style),
  label: button.label || undefined,
  url: button.href || undefined,
  disabled: button.disabled || false,
});

const convertV2TextDisplayToAPI = (textDisplay: TextDisplayComponent) => ({
  type: V2_COMPONENT_TYPE.TextDisplay,
  content: textDisplay.content,
});

const convertV2ThumbnailToAPI = (thumbnail: ThumbnailComponent) => ({
  type: V2_COMPONENT_TYPE.Thumbnail,
  media: {
    url: thumbnail.mediaUrl,
  },
  description: thumbnail.description || undefined,
  spoiler: thumbnail.spoiler || false,
});

const convertV2SectionToAPI = (section: SectionComponent) => {
  const result: {
    type: string;
    components: Array<{ type: string; content: string }>;
    accessory?: {
      type: string;
      style?: number;
      label?: string;
      url?: string | null;
      disabled?: boolean;
      media?: { url: string };
      description?: string;
      spoiler?: boolean;
    };
  } = {
    type: V2_COMPONENT_TYPE.Section,
    components: section.children
      .filter((c): c is TextDisplayComponent => c.type === ComponentType.V2TextDisplay)
      .map(convertV2TextDisplayToAPI),
  };

  if (section.accessory && section.accessory.type === ComponentType.V2Button) {
    result.accessory = convertV2ButtonToAPI(section.accessory as ButtonComponent);
  } else if (section.accessory && section.accessory.type === ComponentType.V2Thumbnail) {
    result.accessory = convertV2ThumbnailToAPI(section.accessory as ThumbnailComponent);
  }

  return result;
};

const convertV2ActionRowToAPI = (actionRow: ActionRowComponent) => ({
  type: V2_COMPONENT_TYPE.ActionRow,
  components: actionRow.children.map(convertV2ButtonToAPI),
});

const convertV2DividerToAPI = (divider: DividerComponent) => ({
  type: V2_COMPONENT_TYPE.Separator,
  divider: divider.visual !== false,
  spacing: divider.spacing || 1,
});

const convertV2MediaGalleryToAPI = (mediaGallery: MediaGalleryComponent) => ({
  type: V2_COMPONENT_TYPE.MediaGallery,
  items: mediaGallery.children.map((item: MediaGalleryItemComponent) => ({
    media: {
      url: item.mediaUrl,
    },
    description: item.description || undefined,
    spoiler: item.spoiler || false,
  })),
});

const convertV2ContainerToAPI = (container: ContainerComponent) => ({
  type: V2_COMPONENT_TYPE.Container,
  accent_color: container.accentColor ?? undefined,
  spoiler: container.spoiler ?? false,
  components: container.children.map((child) => {
    switch (child.type) {
      case ComponentType.V2Divider:
        return convertV2DividerToAPI(child as DividerComponent);
      case ComponentType.V2ActionRow:
        return convertV2ActionRowToAPI(child as ActionRowComponent);
      case ComponentType.V2Section:
        return convertV2SectionToAPI(child as SectionComponent);
      case ComponentType.V2TextDisplay:
        return convertV2TextDisplayToAPI(child as TextDisplayComponent);
      case ComponentType.V2MediaGallery:
        return convertV2MediaGalleryToAPI(child as MediaGalleryComponent);
      default:
        return convertV2DividerToAPI(child as unknown as DividerComponent);
    }
  }),
});

const convertV2RootToTemplatePreviewInput = (
  messageComponent: V2MessageComponentRoot
): Omit<CreateTemplatePreviewInput["data"], "article"> => {
  const componentsV2: CreateTemplatePreviewInput["data"]["componentsV2"] = [];

  messageComponent.children.forEach((child) => {
    if (child.type === ComponentType.V2Section) {
      componentsV2.push(convertV2SectionToAPI(child as SectionComponent));
    } else if (child.type === ComponentType.V2ActionRow) {
      componentsV2.push(convertV2ActionRowToAPI(child as ActionRowComponent));
    } else if (child.type === ComponentType.V2Divider) {
      componentsV2.push(convertV2DividerToAPI(child as DividerComponent));
    } else if (child.type === ComponentType.V2Container) {
      componentsV2.push(convertV2ContainerToAPI(child as ContainerComponent));
    }
  });

  return {
    content: null,
    embeds: undefined,
    componentsV2: componentsV2.length > 0 ? componentsV2 : null,
    connectionFormatOptions: {
      formatTables: messageComponent.formatTables,
      stripImages: messageComponent.stripImages,
      ignoreNewLines: messageComponent.ignoreNewLines,
    },
    enablePlaceholderFallback: messageComponent.enablePlaceholderFallback,
    placeholderLimits: messageComponent.placeholderLimits,
  };
};

const convertLegacyEmbedToPreviewEmbed = (embedComponent: LegacyEmbedComponent) => {
  const embed: NonNullable<CreateTemplatePreviewInput["data"]["embeds"]>[number] = {};

  if (embedComponent.color) {
    embed.color = `${embedComponent.color}`;
  }

  embedComponent.children?.forEach((subComponent) => {
    if (subComponent.type === ComponentType.LegacyEmbedAuthor) {
      embed.author = {
        name: subComponent.authorName || null,
        url: subComponent.authorUrl || null,
        iconUrl: subComponent.authorIconUrl || null,
      };
    } else if (subComponent.type === ComponentType.LegacyEmbedTitle) {
      embed.title = subComponent.title || null;
      embed.url = subComponent.titleUrl || null;
    } else if (subComponent.type === ComponentType.LegacyEmbedDescription) {
      embed.description = subComponent.description || null;
    } else if (subComponent.type === ComponentType.LegacyEmbedImage) {
      embed.image = {
        url: subComponent.imageUrl || null,
      };
    } else if (subComponent.type === ComponentType.LegacyEmbedThumbnail) {
      embed.thumbnail = {
        url: subComponent.thumbnailUrl || null,
      };
    } else if (subComponent.type === ComponentType.LegacyEmbedFooter) {
      embed.footer = {
        text: subComponent.footerText || null,
        iconUrl: subComponent.footerIconUrl || null,
      };
    } else if (subComponent.type === ComponentType.LegacyEmbedField) {
      if (!embed.fields) {
        embed.fields = [];
      }

      if (subComponent.fieldName || subComponent.fieldValue) {
        embed.fields.push({
          name: subComponent.fieldName || "",
          value: subComponent.fieldValue || "",
          inline: subComponent.inline || false,
        });
      }
    } else if (subComponent.type === ComponentType.LegacyEmbedTimestamp) {
      embed.timestamp = subComponent.timestamp || null;
    }
  });

  return embed;
};

export const convertTemplateMessageComponentToPreviewInput = (
  messageComponent?: MessageComponentRoot
): Omit<CreateTemplatePreviewInput["data"], "article"> => {
  if (!messageComponent) {
    return {};
  }

  if (messageComponent.type === ComponentType.V2Root) {
    return convertV2RootToTemplatePreviewInput(messageComponent);
  }

  if (messageComponent.type !== ComponentType.LegacyRoot) {
    return {};
  }

  let content = "";
  let embeds: CreateTemplatePreviewInput["data"]["embeds"] = [];

  messageComponent.children?.forEach((child) => {
    if (child.type === ComponentType.LegacyText) {
      content = (child as LegacyTextComponent).content || "";
    } else if (child.type === ComponentType.LegacyEmbedContainer) {
      embeds = child.children.map((embedChild) =>
        convertLegacyEmbedToPreviewEmbed(embedChild as LegacyEmbedComponent)
      );
    }
  });

  return {
    content: content || null,
    embeds: embeds.length > 0 ? embeds : undefined,
    componentsV2: null,
    connectionFormatOptions: {
      formatTables: messageComponent.formatTables,
      stripImages: messageComponent.stripImages,
      ignoreNewLines: messageComponent.ignoreNewLines,
    },
    enablePlaceholderFallback: messageComponent.enablePlaceholderFallback,
    placeholderLimits: messageComponent.placeholderLimits,
  };
};

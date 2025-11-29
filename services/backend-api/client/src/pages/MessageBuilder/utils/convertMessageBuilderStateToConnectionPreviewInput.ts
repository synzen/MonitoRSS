import { UserFeed } from "../../../features/feed";
import { CreateDiscordChannelConnectionPreviewInput } from "../../../features/feedConnections";
import { FeedDiscordChannelConnection } from "../../../types";
import { DiscordButtonStyle } from "../constants/DiscordButtonStyle";
import {
  ActionRowComponent,
  ButtonComponent,
  ComponentType,
  DividerComponent,
  LegacyEmbedComponent,
  LegacyTextComponent,
  MessageComponentRoot,
  SectionComponent,
  TextDisplayComponent,
  ThumbnailComponent,
  V2MessageComponentRoot,
} from "../types";

// V2 Component Type Constants (string enums matching backend)
const V2_COMPONENT_TYPE = {
  ActionRow: "ACTION_ROW",
  Button: "BUTTON",
  Section: "SECTION",
  TextDisplay: "TEXT_DISPLAY",
  Thumbnail: "THUMBNAIL",
  Separator: "SEPARATOR",
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
  console.log("🚀 ~ convertV2SectionToAPI ~ section:", section);
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
    console.log("🚀 ~ convertV2SectionToAPI ~ result.accessory:", result.accessory);
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

const convertV2RootToPreviewInput = (
  userFeed: UserFeed,
  connection: FeedDiscordChannelConnection,
  messageComponent: V2MessageComponentRoot
): Omit<CreateDiscordChannelConnectionPreviewInput["data"], "article"> => {
  const componentsV2: CreateDiscordChannelConnectionPreviewInput["data"]["componentsV2"] = [];

  messageComponent.children.forEach((child) => {
    if (child.type === ComponentType.V2Section) {
      componentsV2.push(convertV2SectionToAPI(child as SectionComponent));
    } else if (child.type === ComponentType.V2ActionRow) {
      componentsV2.push(convertV2ActionRowToAPI(child as ActionRowComponent));
    } else if (child.type === ComponentType.V2Divider) {
      componentsV2.push(convertV2DividerToAPI(child as DividerComponent));
    }
  });

  return {
    content: null,
    embeds: undefined,
    componentRows: null,
    componentsV2: componentsV2.length > 0 ? componentsV2 : null,
    channelNewThreadExcludesPreview: messageComponent.channelNewThreadExcludesPreview,
    channelNewThreadTitle: messageComponent.channelNewThreadTitle,
    connectionFormatOptions: {
      formatTables: messageComponent.formatTables,
      stripImages: messageComponent.stripImages,
      ignoreNewLines: messageComponent.ignoreNewLines,
    },
    enablePlaceholderFallback: messageComponent.enablePlaceholderFallback,
    forumThreadTags: messageComponent.forumThreadTags,
    forumThreadTitle: messageComponent.forumThreadTitle,
    mentions: messageComponent.mentions,
    placeholderLimits: messageComponent.placeholderLimits,
    customPlaceholders: connection.customPlaceholders,
    externalProperties: userFeed.externalProperties,
    userFeedFormatOptions: userFeed.formatOptions,
  };
};

const convertMessageBuilderStateToConnectionPreviewInput = (
  userFeed: UserFeed,
  connection: FeedDiscordChannelConnection,
  messageComponent?: MessageComponentRoot
): Omit<CreateDiscordChannelConnectionPreviewInput["data"], "article"> => {
  if (!messageComponent) {
    return {};
  }

  if (messageComponent.type === ComponentType.V2Root) {
    return convertV2RootToPreviewInput(userFeed, connection, messageComponent);
  }

  if (messageComponent.type !== ComponentType.LegacyRoot) {
    return {};
  }

  let content = "";
  let embeds: CreateDiscordChannelConnectionPreviewInput["data"]["embeds"] = [];
  const componentRows: Array<{
    id: string;
    components: Array<{ id: string; type: number; label: string; url?: string; style: number }>;
  }> = [];

  messageComponent.children?.forEach((child) => {
    if (child.type === ComponentType.LegacyText) {
      content = child.content || "";
    } else if (child.type === ComponentType.LegacyEmbedContainer) {
      embeds = child.children.map((embedChild) => {
        return convertLegacyEmbedMessageBuilderComponentToEmbed(embedChild as LegacyEmbedComponent);
      });
    } else if (child.type === ComponentType.LegacyActionRow) {
      const componentRow = {
        id: child.id,
        type: 1,
        components:
          child.children
            ?.map((button) => {
              if (button.type === ComponentType.LegacyButton) {
                const styleMap: Record<DiscordButtonStyle, number> = {
                  [DiscordButtonStyle.Primary]: 1,
                  [DiscordButtonStyle.Secondary]: 2,
                  [DiscordButtonStyle.Success]: 3,
                  [DiscordButtonStyle.Danger]: 4,
                  [DiscordButtonStyle.Link]: 5,
                };
                const style = styleMap[button.style] || 1;

                return {
                  id: button.id,
                  type: 2, // Button type
                  style,
                  label: button.label,
                  url: button.url,
                };
              }

              return null;
            })
            .filter((c): c is Exclude<typeof c, null> => !!c) || [],
      };

      if (componentRow.components.length === 0) {
        return;
      }

      componentRows.push(componentRow);
    }
  });

  const legacyTextComponent = messageComponent.children.find(
    (c) => c.type === ComponentType.LegacyText
  );

  return {
    content: content || null,
    embeds: embeds.length > 0 ? embeds : undefined,
    componentRows: componentRows.length > 0 ? componentRows : null,
    channelNewThreadExcludesPreview: messageComponent.channelNewThreadExcludesPreview,
    channelNewThreadTitle: messageComponent.channelNewThreadTitle,
    connectionFormatOptions: {
      formatTables: messageComponent.formatTables,
      stripImages: messageComponent.stripImages,
      ignoreNewLines: messageComponent.ignoreNewLines,
    },
    enablePlaceholderFallback: messageComponent.enablePlaceholderFallback,
    forumThreadTags: messageComponent.forumThreadTags,
    forumThreadTitle: messageComponent.forumThreadTitle,
    mentions: messageComponent.mentions,
    splitOptions: (legacyTextComponent as LegacyTextComponent)?.splitOptions,
    placeholderLimits: messageComponent.placeholderLimits,
    customPlaceholders: connection.customPlaceholders,
    externalProperties: userFeed.externalProperties,
    userFeedFormatOptions: userFeed.formatOptions,
  };
};

const convertLegacyEmbedMessageBuilderComponentToEmbed = (embedComponent: LegacyEmbedComponent) => {
  const embed: Exclude<
    CreateDiscordChannelConnectionPreviewInput["data"]["embeds"],
    undefined
  >[number] = {};

  // Get color from embed component itself
  if (embedComponent.color) {
    embed.color = `${embedComponent.color}`;
  }

  // Process embed subcomponents
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

export default convertMessageBuilderStateToConnectionPreviewInput;

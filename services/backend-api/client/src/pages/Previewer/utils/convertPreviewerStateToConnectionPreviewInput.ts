import { UserFeed } from "../../../features/feed";
import { CreateDiscordChannelConnectionPreviewInput } from "../../../features/feedConnections";
import { FeedDiscordChannelConnection } from "../../../types";
import { DiscordButtonStyle } from "../constants/DiscordButtonStyle";
import { ComponentType, LegacyEmbedComponent, MessageComponentRoot } from "../types";

const convertPreviewerStateToConnectionPreviewInput = (
  userFeed: UserFeed,
  connection: FeedDiscordChannelConnection,
  messageComponent?: MessageComponentRoot
): Omit<CreateDiscordChannelConnectionPreviewInput["data"], "article"> => {
  if (!messageComponent || messageComponent.type !== ComponentType.LegacyRoot) {
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
        return convertLegacyEmbedPreviewerComponentToEmbed(embedChild as LegacyEmbedComponent);
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
    splitOptions: legacyTextComponent?.splitOptions,
    placeholderLimits: messageComponent.placeholderLimits,
    customPlaceholders: connection.customPlaceholders,
    externalProperties: userFeed.externalProperties,
    userFeedFormatOptions: userFeed.formatOptions,
  };
};

const convertLegacyEmbedPreviewerComponentToEmbed = (embedComponent: LegacyEmbedComponent) => {
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
        icon_url: subComponent.authorIconUrl || null,
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
        icon_url: subComponent.footerIconUrl || null,
      };
    } else if (subComponent.type === ComponentType.LegacyEmbedField) {
      if (!embed.fields) {
        embed.fields = [];
      }

      embed.fields.push({
        name: subComponent.fieldName || null,
        value: subComponent.fieldValue || null,
        inline: subComponent.inline || null,
      });
    } else if (subComponent.type === ComponentType.LegacyEmbedTimestamp) {
      embed.timestamp = subComponent.timestamp || null;
    }
  });

  return embed;
};

export default convertPreviewerStateToConnectionPreviewInput;

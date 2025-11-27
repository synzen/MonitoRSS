import { FeedDiscordChannelConnection } from "../../../types";
import {
  ComponentType,
  LegacyMessageComponentRoot,
  LegacyTextComponent,
  LegacyEmbedComponent,
  LegacyEmbedAuthorComponent,
  LegacyEmbedTitleComponent,
  LegacyEmbedDescriptionComponent,
  LegacyEmbedImageComponent,
  LegacyEmbedThumbnailComponent,
  LegacyEmbedFooterComponent,
  LegacyEmbedFieldComponent,
  LegacyEmbedTimestampComponent,
  LegacyActionRowComponent,
  LegacyButtonComponent,
  Component,
} from "../types";
import MessageBuilderFormState from "../types/MessageBuilderFormState";
import { DiscordButtonStyle } from "../constants/DiscordButtonStyle";
import createNewMessageBuilderComponent from "./createNewMessageBuilderComponent";

const createLegacyButtonComponent = (
  button: Exclude<
    FeedDiscordChannelConnection["details"]["componentRows"],
    undefined
  >[number]["components"][number],
  parentId: string,
  index: number
): LegacyButtonComponent => {
  let style = DiscordButtonStyle.Primary;

  switch (button.style) {
    case 1:
      style = DiscordButtonStyle.Primary;
      break;
    case 2:
      style = DiscordButtonStyle.Secondary;
      break;
    case 3:
      style = DiscordButtonStyle.Success;
      break;
    case 4:
      style = DiscordButtonStyle.Danger;
      break;
    case 5:
      style = DiscordButtonStyle.Link;
      break;
    default:
      style = DiscordButtonStyle.Primary;
  }

  return {
    ...(createNewMessageBuilderComponent(
      ComponentType.LegacyButton,
      parentId,
      index
    ) as LegacyButtonComponent),
    label: button.label,
    style,
    disabled: false,
    url: button.url,
  };
};

const createLegacyActionRowComponent = (
  row: Exclude<FeedDiscordChannelConnection["details"]["componentRows"], undefined>[number],
  parentId: string,
  index: number
): LegacyActionRowComponent => {
  const actionRowComponent = createNewMessageBuilderComponent(
    ComponentType.LegacyActionRow,
    parentId,
    index
  ) as LegacyActionRowComponent;

  if (row.components && row.components.length > 0) {
    row.components.forEach((component, componentIndex) => {
      if (component.type === 2) {
        // Button component type
        actionRowComponent.children.push(
          createLegacyButtonComponent(component, actionRowComponent.id, componentIndex)
        );
      }
    });
  }

  return actionRowComponent;
};

const createLegacyEmbedComponent = (
  embed: FeedDiscordChannelConnection["details"]["embeds"][number],
  parentId: string,
  index: number
): LegacyEmbedComponent => {
  const children: Component[] = [];
  const embedComponent = {
    ...(createNewMessageBuilderComponent(
      ComponentType.LegacyEmbed,
      parentId,
      index
    ) as LegacyEmbedComponent),
    children,
  };

  // Convert hex color to number if present
  if (embed.color && embed.color.startsWith("#")) {
    embedComponent.color = parseInt(embed.color.replace("#", ""), 16);
  } else if (embed.color) {
    embedComponent.color = parseInt(embed.color, 10);
  }

  // Add author component if present
  if (embed.author?.name) {
    children.push({
      ...createNewMessageBuilderComponent(
        ComponentType.LegacyEmbedAuthor,
        embedComponent.id,
        index
      ),
      authorName: embed.author.name,
      authorUrl: embed.author.url,
      authorIconUrl: embed.author.iconUrl,
    } as LegacyEmbedAuthorComponent);
  }

  // Add title component if present
  if (embed.title) {
    children.push({
      ...createNewMessageBuilderComponent(ComponentType.LegacyEmbedTitle, embedComponent.id, index),
      title: embed.title,
      titleUrl: embed.url,
    } as LegacyEmbedTitleComponent);
  }

  // Add description component if present
  if (embed.description) {
    children.push({
      ...createNewMessageBuilderComponent(
        ComponentType.LegacyEmbedDescription,
        embedComponent.id,
        index
      ),
      description: embed.description,
    } as LegacyEmbedDescriptionComponent);
  }

  // Add fields if present
  if (embed.fields && embed.fields.length > 0) {
    embed.fields.forEach((field, fieldIndex) => {
      children.push({
        ...createNewMessageBuilderComponent(
          ComponentType.LegacyEmbedField,
          embedComponent.id,
          fieldIndex
        ),
        fieldName: field.name,
        fieldValue: field.value,
        inline: field.inline || false,
      } as LegacyEmbedFieldComponent);
    });
  }

  // Add image component if present
  if (embed.image?.url) {
    children.push({
      ...createNewMessageBuilderComponent(ComponentType.LegacyEmbedImage, embedComponent.id, index),
      imageUrl: embed.image.url,
    } as LegacyEmbedImageComponent);
  }

  // Add thumbnail component if present
  if (embed.thumbnail?.url) {
    children.push({
      ...createNewMessageBuilderComponent(
        ComponentType.LegacyEmbedThumbnail,
        embedComponent.id,
        index
      ),
      thumbnailUrl: embed.thumbnail.url,
    } as LegacyEmbedThumbnailComponent);
  }

  // Add footer component if present
  if (embed.footer?.text) {
    children.push({
      ...createNewMessageBuilderComponent(
        ComponentType.LegacyEmbedFooter,
        embedComponent.id,
        index
      ),
      footerText: embed.footer.text,
      footerIconUrl: embed.footer.iconUrl,
    } as LegacyEmbedFooterComponent);
  }

  // Add timestamp component if present
  if (embed.timestamp) {
    children.push({
      ...createNewMessageBuilderComponent(
        ComponentType.LegacyEmbedTimestamp,
        embedComponent.id,
        index
      ),
      timestamp: embed.timestamp,
    } as LegacyEmbedTimestampComponent);
  }

  return embedComponent;
};

export const convertConnectionToMessageBuilderState = (
  connection: FeedDiscordChannelConnection | null | undefined
): MessageBuilderFormState => {
  if (!connection?.details) {
    return {};
  }

  const { content, embeds, componentRows } = connection.details;

  // Check if there's any message content to convert
  const hasContent =
    !!content || (embeds && embeds.length > 0) || (componentRows && componentRows.length > 0);

  // Create a legacy root component that contains the existing message data
  const legacyRootComponent: LegacyMessageComponentRoot = {
    ...(createNewMessageBuilderComponent(
      ComponentType.LegacyRoot,
      "",
      0
    ) as LegacyMessageComponentRoot),
    children: [],
    formatTables: connection.details?.formatter?.formatTables,
    stripImages: connection.details?.formatter?.stripImages,
    ignoreNewLines: connection.details?.formatter?.ignoreNewLines,
    forumThreadTitle: connection.details?.forumThreadTitle,
    isForumChannel: connection.details?.channel?.type === "forum",
    placeholderLimits: connection.details?.placeholderLimits,
    mentions: connection.mentions,
    channelNewThreadExcludesPreview: connection.details?.channelNewThreadExcludesPreview,
    channelNewThreadTitle: connection.details?.channelNewThreadTitle,
    enablePlaceholderFallback: connection.details.enablePlaceholderFallback,
    forumThreadTags: connection.details?.forumThreadTags,
  };

  if (!hasContent) {
    return {
      messageComponent: legacyRootComponent,
    };
  }

  // Add text content if present
  if (content) {
    legacyRootComponent.children.push({
      ...(createNewMessageBuilderComponent(
        ComponentType.LegacyText,
        legacyRootComponent.id,
        0
      ) as LegacyTextComponent),
      content,
    });
  }

  // Add embed components if present
  if (embeds && embeds.length > 0) {
    const container = createNewMessageBuilderComponent(
      ComponentType.LegacyEmbedContainer,
      legacyRootComponent.id,
      0
    );
    container.children = embeds.map((embed, index) =>
      createLegacyEmbedComponent(embed, container.id, index)
    );
    legacyRootComponent.children.push(container);
  }

  // Add action row components if present
  if (componentRows && componentRows.length > 0) {
    componentRows.forEach((row, rowIndex) => {
      if (row.components.length) {
        legacyRootComponent.children.push(
          createLegacyActionRowComponent(row, legacyRootComponent.id, rowIndex)
        );
      }
    });
  }

  return {
    messageComponent: legacyRootComponent,
  };
};

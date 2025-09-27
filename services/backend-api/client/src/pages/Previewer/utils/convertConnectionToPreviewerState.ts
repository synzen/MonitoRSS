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
import PreviewerFormState from "../types/PreviewerFormState";
import { DiscordButtonStyle } from "../constants/DiscordButtonStyle";
import createNewPreviewerComponent from "./createNewPreviewComponent";

const createLegacyButtonComponent = (
  button: Exclude<
    FeedDiscordChannelConnection["details"]["componentRows"],
    undefined
  >[number]["components"][number]
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
    ...(createNewPreviewerComponent(ComponentType.LegacyButton) as LegacyButtonComponent),
    label: button.label,
    style,
    disabled: false,
    url: button.url,
  };
};

const createLegacyActionRowComponent = (
  row: Exclude<FeedDiscordChannelConnection["details"]["componentRows"], undefined>[number]
): LegacyActionRowComponent => {
  const children: LegacyButtonComponent[] = [];

  if (row.components && row.components.length > 0) {
    row.components.forEach((component) => {
      if (component.type === 2) {
        // Button component type
        children.push(createLegacyButtonComponent(component));
      }
    });
  }

  return {
    ...(createNewPreviewerComponent(ComponentType.LegacyActionRow) as LegacyActionRowComponent),
    children,
  };
};

const createLegacyEmbedComponent = (
  embed: FeedDiscordChannelConnection["details"]["embeds"][number]
): LegacyEmbedComponent => {
  const children: Component[] = [];
  let color: number | undefined;

  // Convert hex color to number if present
  if (embed.color) {
    color = parseInt(embed.color.replace("#", ""), 16);
  }

  // Add author component if present
  if (embed.author?.name) {
    children.push({
      ...createNewPreviewerComponent(ComponentType.LegacyEmbedAuthor),
      authorName: embed.author.name,
      authorUrl: embed.author.url,
      authorIconUrl: embed.author.iconUrl,
    } as LegacyEmbedAuthorComponent);
  }

  // Add title component if present
  if (embed.title) {
    children.push({
      ...createNewPreviewerComponent(ComponentType.LegacyEmbedTitle),
      title: embed.title,
      titleUrl: embed.url,
    } as LegacyEmbedTitleComponent);
  }

  // Add description component if present
  if (embed.description) {
    children.push({
      ...createNewPreviewerComponent(ComponentType.LegacyEmbedDescription),
      description: embed.description,
    } as LegacyEmbedDescriptionComponent);
  }

  // Add fields if present
  if (embed.fields && embed.fields.length > 0) {
    embed.fields.forEach((field: any) => {
      children.push({
        ...createNewPreviewerComponent(ComponentType.LegacyEmbedField),
        fieldName: field.name,
        fieldValue: field.value,
        inline: field.inline || false,
      } as LegacyEmbedFieldComponent);
    });
  }

  // Add image component if present
  if (embed.image?.url) {
    children.push({
      ...createNewPreviewerComponent(ComponentType.LegacyEmbedImage),
      imageUrl: embed.image.url,
    } as LegacyEmbedImageComponent);
  }

  // Add thumbnail component if present
  if (embed.thumbnail?.url) {
    children.push({
      ...createNewPreviewerComponent(ComponentType.LegacyEmbedThumbnail),
      thumbnailUrl: embed.thumbnail.url,
    } as LegacyEmbedThumbnailComponent);
  }

  // Add footer component if present
  if (embed.footer?.text) {
    children.push({
      ...createNewPreviewerComponent(ComponentType.LegacyEmbedFooter),
      footerText: embed.footer.text,
      footerIconUrl: embed.footer.iconUrl,
    } as LegacyEmbedFooterComponent);
  }

  // Add timestamp component if present
  if (embed.timestamp) {
    children.push({
      ...createNewPreviewerComponent(ComponentType.LegacyEmbedTimestamp),
      timestamp: embed.timestamp,
    } as LegacyEmbedTimestampComponent);
  }

  return {
    ...(createNewPreviewerComponent(ComponentType.LegacyEmbed) as LegacyEmbedComponent),
    children,
    color,
  };
};

export const convertConnectionToPreviewerState = (
  connection: FeedDiscordChannelConnection | null | undefined
): PreviewerFormState => {
  if (!connection?.details) {
    return {};
  }

  const { content, embeds, componentRows } = connection.details;

  // Check if there's any message content to convert
  const hasContent =
    !!content || (embeds && embeds.length > 0) || (componentRows && componentRows.length > 0);

  // Create a legacy root component that contains the existing message data
  const legacyRootComponent: LegacyMessageComponentRoot = {
    ...(createNewPreviewerComponent(ComponentType.LegacyRoot) as LegacyMessageComponentRoot),
    children: [],
    formatTables: connection.details?.formatter?.formatTables,
    stripImages: connection.details?.formatter?.stripImages,
    ignoreNewLines: connection.details?.formatter?.ignoreNewLines,
    forumThreadTitle: connection.details?.forumThreadTitle,
    isForumChannel: connection.details?.channel?.type === "forum",
    ...connection.details,
  };

  if (!hasContent) {
    return {
      messageComponent: legacyRootComponent,
    };
  }

  // Add text content if present
  if (content) {
    legacyRootComponent.children.push({
      ...(createNewPreviewerComponent(ComponentType.LegacyText) as LegacyTextComponent),
      content,
    });
  }

  // Add embed components if present
  if (embeds && embeds.length > 0) {
    const container = createNewPreviewerComponent(ComponentType.LegacyEmbedContainer);
    container.children = embeds.map((embed) => createLegacyEmbedComponent(embed));
    legacyRootComponent.children.push(container);
  }

  // Add action row components if present
  if (componentRows && componentRows.length > 0) {
    componentRows.forEach((row) => {
      if (row.components.length) {
        legacyRootComponent.children.push(createLegacyActionRowComponent(row));
      }
    });
  }

  return {
    messageComponent: legacyRootComponent,
  };
};

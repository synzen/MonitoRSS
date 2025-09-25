import { v4 as uuidv4 } from "uuid";
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
import getPreviewerComponentLabel from "./getPreviewerComponentLabel";

const createLegacyTextComponent = (content: string): LegacyTextComponent => ({
  id: uuidv4(),
  name: getPreviewerComponentLabel(ComponentType.LegacyText),
  type: ComponentType.LegacyText,
  content,
});

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
    id: uuidv4(),
    name: getPreviewerComponentLabel(ComponentType.LegacyButton),
    type: ComponentType.LegacyButton,
    label: button.label,
    style,
    disabled: false,
    url: button.url,
  };
};

const createLegacyActionRowComponent = (
  row: Exclude<FeedDiscordChannelConnection["details"]["componentRows"], undefined>[number],
  index: number
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
    id: uuidv4(),
    name: getPreviewerComponentLabel(ComponentType.LegacyActionRow),
    type: ComponentType.LegacyActionRow,
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
      id: uuidv4(),
      name: getPreviewerComponentLabel(ComponentType.LegacyEmbedAuthor),
      type: ComponentType.LegacyEmbedAuthor,
      authorName: embed.author.name,
      authorUrl: embed.author.url,
      authorIconUrl: embed.author.iconUrl,
    } as LegacyEmbedAuthorComponent);
  }

  // Add title component if present
  if (embed.title) {
    children.push({
      id: uuidv4(),
      name: getPreviewerComponentLabel(ComponentType.LegacyEmbedTitle),
      type: ComponentType.LegacyEmbedTitle,
      title: embed.title,
      titleUrl: embed.url,
    } as LegacyEmbedTitleComponent);
  }

  // Add description component if present
  if (embed.description) {
    children.push({
      id: uuidv4(),
      name: getPreviewerComponentLabel(ComponentType.LegacyEmbedDescription),
      type: ComponentType.LegacyEmbedDescription,
      description: embed.description,
    } as LegacyEmbedDescriptionComponent);
  }

  // Add fields if present
  if (embed.fields && embed.fields.length > 0) {
    embed.fields.forEach((field: any) => {
      children.push({
        id: uuidv4(),
        name: getPreviewerComponentLabel(ComponentType.LegacyEmbedField),
        type: ComponentType.LegacyEmbedField,
        fieldName: field.name,
        fieldValue: field.value,
        inline: field.inline || false,
      } as LegacyEmbedFieldComponent);
    });
  }

  // Add image component if present
  if (embed.image?.url) {
    children.push({
      id: uuidv4(),
      name: getPreviewerComponentLabel(ComponentType.LegacyEmbedImage),
      type: ComponentType.LegacyEmbedImage,
      imageUrl: embed.image.url,
    } as LegacyEmbedImageComponent);
  }

  // Add thumbnail component if present
  if (embed.thumbnail?.url) {
    children.push({
      id: uuidv4(),
      name: getPreviewerComponentLabel(ComponentType.LegacyEmbedThumbnail),
      type: ComponentType.LegacyEmbedThumbnail,
      thumbnailUrl: embed.thumbnail.url,
    } as LegacyEmbedThumbnailComponent);
  }

  // Add footer component if present
  if (embed.footer?.text) {
    children.push({
      id: uuidv4(),
      name: getPreviewerComponentLabel(ComponentType.LegacyEmbedFooter),
      type: ComponentType.LegacyEmbedFooter,
      footerText: embed.footer.text,
      footerIconUrl: embed.footer.iconUrl,
    } as LegacyEmbedFooterComponent);
  }

  // Add timestamp component if present
  if (embed.timestamp) {
    children.push({
      id: uuidv4(),
      name: getPreviewerComponentLabel(ComponentType.LegacyEmbedTimestamp),
      type: ComponentType.LegacyEmbedTimestamp,
      timestamp: embed.timestamp,
    } as LegacyEmbedTimestampComponent);
  }

  return {
    id: uuidv4(),
    name: getPreviewerComponentLabel(ComponentType.LegacyEmbed),
    type: ComponentType.LegacyEmbed,
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

  if (!hasContent) {
    return {};
  }

  const children: Component[] = [];

  // Add text content if present
  if (content) {
    children.push(createLegacyTextComponent(content));
  }

  // Add embed components if present
  if (embeds && embeds.length > 0) {
    children.push({
      type: ComponentType.LegacyEmbedContainer,
      id: uuidv4(),
      name: getPreviewerComponentLabel(ComponentType.LegacyEmbedContainer),
      children: embeds.map((embed) => createLegacyEmbedComponent(embed)),
    });
  }

  // Add action row components if present
  if (componentRows && componentRows.length > 0) {
    componentRows.forEach((row, index) => {
      children.push(createLegacyActionRowComponent(row, index));
    });
  }

  // Create a legacy root component that contains the existing message data
  const legacyRootComponent: LegacyMessageComponentRoot = {
    id: uuidv4(),
    name: getPreviewerComponentLabel(ComponentType.LegacyRoot),
    type: ComponentType.LegacyRoot,
    children,
    formatTables: connection.details?.formatter?.formatTables,
    stripImages: connection.details?.formatter?.stripImages,
    ignoreNewLines: connection.details?.formatter?.ignoreNewLines,
    forumThreadTitle: connection.details?.forumThreadTitle,
    isForumChannel: connection.details?.channel?.type === "forum",
    ...connection.details,
  };

  return {
    messageComponent: legacyRootComponent,
  };
};

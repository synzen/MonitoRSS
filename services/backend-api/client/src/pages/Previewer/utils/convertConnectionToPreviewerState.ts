import { v4 as uuidv4 } from "uuid";
import { FeedDiscordChannelConnection } from "../../../types";
import {
  PreviewerFormState,
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
  Component,
} from "../types";

const createLegacyTextComponent = (content: string): LegacyTextComponent => ({
  id: uuidv4(),
  name: "Text Content",
  type: ComponentType.LegacyText,
  content,
});

const createLegacyEmbedComponent = (embed: any, index: number): LegacyEmbedComponent => {
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
      name: "Embed Author",
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
      name: "Embed Title",
      type: ComponentType.LegacyEmbedTitle,
      title: embed.title,
      titleUrl: embed.url,
    } as LegacyEmbedTitleComponent);
  }

  // Add description component if present
  if (embed.description) {
    children.push({
      id: uuidv4(),
      name: "Embed Description",
      type: ComponentType.LegacyEmbedDescription,
      description: embed.description,
    } as LegacyEmbedDescriptionComponent);
  }

  // Add fields if present
  if (embed.fields && embed.fields.length > 0) {
    embed.fields.forEach((field: any) => {
      children.push({
        id: uuidv4(),
        name: field.name,
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
      name: "Embed Image",
      type: ComponentType.LegacyEmbedImage,
      imageUrl: embed.image.url,
    } as LegacyEmbedImageComponent);
  }

  // Add thumbnail component if present
  if (embed.thumbnail?.url) {
    children.push({
      id: uuidv4(),
      name: "Embed Thumbnail",
      type: ComponentType.LegacyEmbedThumbnail,
      thumbnailUrl: embed.thumbnail.url,
    } as LegacyEmbedThumbnailComponent);
  }

  // Add footer component if present
  if (embed.footer?.text) {
    children.push({
      id: uuidv4(),
      name: "Embed Footer",
      type: ComponentType.LegacyEmbedFooter,
      footerText: embed.footer.text,
      footerIconUrl: embed.footer.iconUrl,
    } as LegacyEmbedFooterComponent);
  }

  // Add timestamp component if present
  if (embed.timestamp) {
    children.push({
      id: uuidv4(),
      name: "Embed Timestamp",
      type: ComponentType.LegacyEmbedTimestamp,
      timestamp: embed.timestamp,
    } as LegacyEmbedTimestampComponent);
  }

  return {
    id: uuidv4(),
    name: `Embed ${index + 1}`,
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
    embeds.forEach((embed, index) => {
      children.push(createLegacyEmbedComponent(embed, index));
    });
  }

  // Create a legacy root component that contains the existing message data
  const legacyRootComponent: LegacyMessageComponentRoot = {
    id: uuidv4(),
    name: "Legacy Discord Message",
    type: ComponentType.LegacyRoot,
    children,
  };

  return {
    messageComponent: legacyRootComponent,
  };
};

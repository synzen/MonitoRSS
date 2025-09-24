import { DiscordButtonStyle } from "../constants/DiscordButtonStyle";
import { Component, ComponentType } from "../types";

const createNewPreviewerComponent = (type: ComponentType): Component => {
  switch (type) {
    case ComponentType.LegacyActionRow:
      return {
        id: `legacy-actionrow-${Date.now()}`,
        type: ComponentType.LegacyActionRow,
        name: `Legacy Action Row`,
        children: [],
      };
    case ComponentType.LegacyButton:
      return {
        id: `legacy-button-${Date.now()}`,
        type: ComponentType.LegacyButton,
        name: `Legacy Button`,
        label: "New Button",
        style: DiscordButtonStyle.Primary,
        disabled: false,
      };
    case ComponentType.LegacyText:
      return {
        id: `legacy-text-${Date.now()}`,
        type: ComponentType.LegacyText,
        name: `Legacy Text`,
        content: "Hello from legacy Discord message!",
      };
    case ComponentType.LegacyEmbed:
      return {
        id: `legacy-embed-${Date.now()}`,
        type: ComponentType.LegacyEmbed,
        name: `Legacy Embed`,
        children: [],
      };

    case ComponentType.LegacyEmbedAuthor:
      return {
        id: `embed-author-${Date.now()}`,
        type: ComponentType.LegacyEmbedAuthor,
        name: `Embed Author`,
        authorName: "",
        authorUrl: "",
        authorIconUrl: "",
      };
    case ComponentType.LegacyEmbedTitle:
      return {
        id: `embed-title-${Date.now()}`,
        type: ComponentType.LegacyEmbedTitle,
        name: `Embed Title`,
        title: "",
        titleUrl: "",
      };
    case ComponentType.LegacyEmbedDescription:
      return {
        id: `embed-description-${Date.now()}`,
        type: ComponentType.LegacyEmbedDescription,
        name: `Embed Description`,
        description: "",
      };
    case ComponentType.LegacyEmbedImage:
      return {
        id: `embed-image-${Date.now()}`,
        type: ComponentType.LegacyEmbedImage,
        name: `Embed Image`,
        imageUrl: "",
      };
    case ComponentType.LegacyEmbedThumbnail:
      return {
        id: `embed-thumbnail-${Date.now()}`,
        type: ComponentType.LegacyEmbedThumbnail,
        name: `Embed Thumbnail`,
        thumbnailUrl: "",
      };
    case ComponentType.LegacyEmbedFooter:
      return {
        id: `embed-footer-${Date.now()}`,
        type: ComponentType.LegacyEmbedFooter,
        name: `Embed Footer`,
        footerText: "",
        footerIconUrl: "",
      };
    case ComponentType.LegacyEmbedField:
      return {
        id: `embed-field-${Date.now()}`,
        type: ComponentType.LegacyEmbedField,
        name: `Embed Field`,
        fieldName: "",
        fieldValue: "",
        inline: false,
      };
    case ComponentType.LegacyEmbedTimestamp:
      return {
        id: `embed-timestamp-${Date.now()}`,
        type: ComponentType.LegacyEmbedTimestamp,
        name: `Embed Timestamp`,
        timestamp: "",
      };
    case ComponentType.V2TextDisplay:
      return {
        id: `text-${Date.now()}`,
        type: ComponentType.V2TextDisplay,
        name: `Text Display`,
        content: "Hello, Discord!",
      };
    case ComponentType.V2ActionRow:
      return {
        id: `actionrow-${Date.now()}`,
        type: ComponentType.V2ActionRow,
        name: `Action Row`,
        children: [],
      };
    case ComponentType.V2Button:
      return {
        id: `button-${Date.now()}`,
        type: ComponentType.V2Button,
        name: `Button`,
        label: "New Button",
        style: DiscordButtonStyle.Primary,
        disabled: false,
        href: "",
      };
    case ComponentType.V2Section:
      return {
        id: `section-${Date.now()}`,
        type: ComponentType.V2Section,
        name: `Section`,
        children: [],
      };
    case ComponentType.V2Divider:
      return {
        id: `divider-${Date.now()}`,
        type: ComponentType.V2Divider,
        name: `Divider`,
        visual: true,
        spacing: 1,
        children: [],
      };
    default:
      throw new Error(`Unknown child type: ${type}`);
  }
};

export default createNewPreviewerComponent;

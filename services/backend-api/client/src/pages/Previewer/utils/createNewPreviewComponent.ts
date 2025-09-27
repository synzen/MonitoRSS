import { v4 as uuidv4 } from "uuid";
import { DiscordButtonStyle } from "../constants/DiscordButtonStyle";
import {
  ActionRowComponent,
  ButtonComponent,
  Component,
  ComponentType,
  DividerComponent,
  LegacyActionRowComponent,
  LegacyButtonComponent,
  LegacyEmbedAuthorComponent,
  LegacyEmbedComponent,
  LegacyEmbedContainerComponent,
  LegacyEmbedDescriptionComponent,
  LegacyEmbedFieldComponent,
  LegacyEmbedFooterComponent,
  LegacyEmbedImageComponent,
  LegacyEmbedThumbnailComponent,
  LegacyEmbedTimestampComponent,
  LegacyEmbedTitleComponent,
  LegacyTextComponent,
  SectionComponent,
  TextDisplayComponent,
} from "../types";
import getPreviewerComponentLabel from "./getPreviewerComponentLabel";

const createNewPreviewerComponent = (type: ComponentType): Component => {
  const base = {
    id: `${type}-${uuidv4()}`,
    name: getPreviewerComponentLabel(type),
    type,
  };

  switch (type) {
    case ComponentType.LegacyRoot:
      return {
        ...base,
        children: [],
      } as Component;
    case ComponentType.V2Root:
      return {
        ...base,
        children: [],
      } as Component;

    case ComponentType.LegacyActionRow:
      return {
        ...base,
        children: [],
      } as LegacyActionRowComponent;
    case ComponentType.LegacyButton:
      return {
        ...base,
        label: "New Button",
        style: DiscordButtonStyle.Link,
        disabled: false,
      } as LegacyButtonComponent;
    case ComponentType.LegacyText:
      return {
        ...base,
        content: "Hello from legacy Discord message!",
      } as LegacyTextComponent;
    case ComponentType.LegacyEmbedContainer:
      return {
        ...base,
        children: [],
      } as LegacyEmbedContainerComponent;
    case ComponentType.LegacyEmbed:
      return {
        ...base,
        children: [],
      } as LegacyEmbedComponent;

    case ComponentType.LegacyEmbedAuthor:
      return {
        ...base,
        authorName: "",
        authorUrl: "",
        authorIconUrl: "",
      } as LegacyEmbedAuthorComponent;
    case ComponentType.LegacyEmbedTitle:
      return {
        ...base,
        title: "",
        titleUrl: "",
      } as LegacyEmbedTitleComponent;
    case ComponentType.LegacyEmbedDescription:
      return {
        ...base,
        description: "",
      } as LegacyEmbedDescriptionComponent;
    case ComponentType.LegacyEmbedImage:
      return {
        ...base,
        imageUrl: "",
      } as LegacyEmbedImageComponent;
    case ComponentType.LegacyEmbedThumbnail:
      return {
        ...base,
        thumbnailUrl: "",
      } as LegacyEmbedThumbnailComponent;
    case ComponentType.LegacyEmbedFooter:
      return {
        ...base,
        footerText: "",
        footerIconUrl: "",
      } as LegacyEmbedFooterComponent;
    case ComponentType.LegacyEmbedField:
      return {
        ...base,
        fieldName: "",
        fieldValue: "",
        inline: false,
      } as LegacyEmbedFieldComponent;
    case ComponentType.LegacyEmbedTimestamp:
      return {
        ...base,
        timestamp: "",
      } as LegacyEmbedTimestampComponent;
    case ComponentType.V2TextDisplay:
      return {
        ...base,
        content: "Hello, Discord!",
      } as TextDisplayComponent;
    case ComponentType.V2ActionRow:
      return {
        ...base,
        children: [],
      } as ActionRowComponent;
    case ComponentType.V2Button:
      return {
        ...base,
        label: "New Button",
        style: DiscordButtonStyle.Primary,
        disabled: false,
        href: "",
      } as ButtonComponent;
    case ComponentType.V2Section:
      return {
        ...base,
        children: [],
      } as SectionComponent;
    case ComponentType.V2Divider:
      return {
        ...base,
        visual: true,
        spacing: 1,
        children: [],
      } as DividerComponent;
    default:
      throw new Error(`Unknown child type: ${type}`);
  }
};

export default createNewPreviewerComponent;

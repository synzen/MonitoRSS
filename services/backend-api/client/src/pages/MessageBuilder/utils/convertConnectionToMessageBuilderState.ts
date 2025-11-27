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
  V2MessageComponentRoot,
  TextDisplayComponent,
  SectionComponent,
  ActionRowComponent,
  ButtonComponent,
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
  if (embed.color) {
    embedComponent.color = parseInt(embed.color.replace("#", ""), 16);
  }

  // Add author component if present
  if (embed.author?.name) {
    children.push({
      ...createNewMessageBuilderComponent(ComponentType.LegacyEmbedAuthor, embedComponent.id, index),
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
      ...createNewMessageBuilderComponent(ComponentType.LegacyEmbedThumbnail, embedComponent.id, index),
      thumbnailUrl: embed.thumbnail.url,
    } as LegacyEmbedThumbnailComponent);
  }

  // Add footer component if present
  if (embed.footer?.text) {
    children.push({
      ...createNewMessageBuilderComponent(ComponentType.LegacyEmbedFooter, embedComponent.id, index),
      footerText: embed.footer.text,
      footerIconUrl: embed.footer.iconUrl,
    } as LegacyEmbedFooterComponent);
  }

  // Add timestamp component if present
  if (embed.timestamp) {
    children.push({
      ...createNewMessageBuilderComponent(ComponentType.LegacyEmbedTimestamp, embedComponent.id, index),
      timestamp: embed.timestamp,
    } as LegacyEmbedTimestampComponent);
  }

  return embedComponent;
};

// V2 Component Type Constants (matching backend Discord API values)
const V2_COMPONENT_TYPE = {
  ActionRow: 1,
  Button: 2,
  Section: 9,
  TextDisplay: 10,
  Thumbnail: 11,
} as const;

type V2ComponentFromAPI = NonNullable<FeedDiscordChannelConnection["details"]["componentsV2"]>[number];

const getButtonStyleFromNumber = (styleNum: number): DiscordButtonStyle => {
  switch (styleNum) {
    case 1:
      return DiscordButtonStyle.Primary;
    case 2:
      return DiscordButtonStyle.Secondary;
    case 3:
      return DiscordButtonStyle.Success;
    case 4:
      return DiscordButtonStyle.Danger;
    case 5:
      return DiscordButtonStyle.Link;
    default:
      return DiscordButtonStyle.Primary;
  }
};

const createV2ButtonComponent = (
  button: NonNullable<V2ComponentFromAPI["accessory"]>,
  parentId: string,
  index: number
): ButtonComponent => {
  return {
    ...(createNewMessageBuilderComponent(ComponentType.V2Button, parentId, index) as ButtonComponent),
    label: button.label || "",
    style: getButtonStyleFromNumber(button.style || 1),
    disabled: button.disabled || false,
    href: button.url || undefined,
  };
};

const createV2TextDisplayComponent = (
  textDisplay: { type: number; content?: string },
  parentId: string,
  index: number
): TextDisplayComponent => {
  return {
    ...(createNewMessageBuilderComponent(ComponentType.V2TextDisplay, parentId, index) as TextDisplayComponent),
    content: textDisplay.content || "",
  };
};

const createV2SectionComponent = (
  section: V2ComponentFromAPI,
  parentId: string,
  index: number
): SectionComponent => {
  const sectionComponent = {
    ...(createNewMessageBuilderComponent(ComponentType.V2Section, parentId, index) as SectionComponent),
    children: [] as Component[],
  };

  // Add text display components
  if (section.components && section.components.length > 0) {
    section.components.forEach((comp, compIndex) => {
      if (comp.type === V2_COMPONENT_TYPE.TextDisplay) {
        sectionComponent.children.push(
          createV2TextDisplayComponent(comp, sectionComponent.id, compIndex)
        );
      }
    });
  }

  // Add accessory (button or thumbnail)
  if (section.accessory && section.accessory.type === V2_COMPONENT_TYPE.Button) {
    sectionComponent.accessory = createV2ButtonComponent(section.accessory, sectionComponent.id, 0);
  }

  return sectionComponent;
};

const createV2ActionRowComponent = (
  row: V2ComponentFromAPI,
  parentId: string,
  index: number
): ActionRowComponent => {
  const actionRowComponent = {
    ...(createNewMessageBuilderComponent(ComponentType.V2ActionRow, parentId, index) as ActionRowComponent),
    children: [] as ButtonComponent[],
  };

  // Add button components
  if (row.components && row.components.length > 0) {
    row.components.forEach((comp, compIndex) => {
      if (comp.type === V2_COMPONENT_TYPE.Button) {
        actionRowComponent.children.push(
          createV2ButtonComponent(comp as NonNullable<V2ComponentFromAPI["accessory"]>, actionRowComponent.id, compIndex)
        );
      }
    });
  }

  return actionRowComponent;
};

export const convertConnectionToMessageBuilderState = (
  connection: FeedDiscordChannelConnection | null | undefined
): MessageBuilderFormState => {
  if (!connection?.details) {
    return {};
  }

  const { content, embeds, componentRows, componentsV2 } = connection.details;

  // Shared properties for both root types
  const sharedRootProperties = {
    forumThreadTitle: connection.details?.forumThreadTitle,
    isForumChannel: connection.details?.channel?.type === "forum",
    placeholderLimits: connection.details?.placeholderLimits,
    mentions: connection.mentions,
    channelNewThreadExcludesPreview: connection.details?.channelNewThreadExcludesPreview,
    channelNewThreadTitle: connection.details?.channelNewThreadTitle,
    forumThreadTags: connection.details?.forumThreadTags,
  };

  // Check if this is a V2 connection (has componentsV2 data)
  if (componentsV2 && componentsV2.length > 0) {
    const v2RootComponent: V2MessageComponentRoot = {
      ...(createNewMessageBuilderComponent(ComponentType.V2Root, "", 0) as V2MessageComponentRoot),
      children: [],
      ...sharedRootProperties,
    };

    // Convert V2 components
    componentsV2.forEach((component, index) => {
      if (component.type === V2_COMPONENT_TYPE.Section) {
        v2RootComponent.children.push(createV2SectionComponent(component, v2RootComponent.id, index));
      } else if (component.type === V2_COMPONENT_TYPE.ActionRow) {
        v2RootComponent.children.push(createV2ActionRowComponent(component, v2RootComponent.id, index));
      }
    });

    return {
      messageComponent: v2RootComponent,
    };
  }

  // Check if there's any legacy message content to convert
  const hasContent =
    !!content || (embeds && embeds.length > 0) || (componentRows && componentRows.length > 0);

  // Create a legacy root component that contains the existing message data
  const legacyRootComponent: LegacyMessageComponentRoot = {
    ...(createNewMessageBuilderComponent(ComponentType.LegacyRoot, "", 0) as LegacyMessageComponentRoot),
    children: [],
    formatTables: connection.details?.formatter?.formatTables,
    stripImages: connection.details?.formatter?.stripImages,
    ignoreNewLines: connection.details?.formatter?.ignoreNewLines,
    enablePlaceholderFallback: connection.details.enablePlaceholderFallback,
    ...sharedRootProperties,
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

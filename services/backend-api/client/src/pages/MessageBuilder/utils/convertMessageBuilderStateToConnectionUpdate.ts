import { UpdateDiscordChannelConnectionInput } from "../../../features/feedConnections";
import { DiscordButtonStyle } from "../constants/DiscordButtonStyle";
import {
  ComponentType,
  DividerComponent,
  LegacyActionRowComponent,
  LegacyButtonComponent,
  LegacyMessageComponentRoot,
  LegacyTextComponent,
  MessageComponentRoot,
  V2MessageComponentRoot,
  ActionRowComponent,
  ButtonComponent,
  SectionComponent,
  TextDisplayComponent,
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
    };
  } = {
    type: V2_COMPONENT_TYPE.Section,
    components: section.children
      .filter((c) => c.type === ComponentType.V2TextDisplay)
      .map((c) => convertV2TextDisplayToAPI(c as TextDisplayComponent)),
  };

  if (section.accessory && section.accessory.type === ComponentType.V2Button) {
    result.accessory = convertV2ButtonToAPI(section.accessory as ButtonComponent);
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

const convertV2RootToConnectionUpdate = (
  component: V2MessageComponentRoot
): UpdateDiscordChannelConnectionInput["details"] => {
  const details: UpdateDiscordChannelConnectionInput["details"] = {};

  // Convert V2 components
  const componentsV2: Array<{
    type: string;
    content?: string;
    components?: Array<{
      type: string;
      content?: string;
      style?: number;
      label?: string;
      url?: string | null;
      disabled?: boolean;
    }>;
    accessory?: {
      type: string;
      style?: number;
      label?: string;
      url?: string | null;
      disabled?: boolean;
    } | null;
  }> = [];

  component.children.forEach((child) => {
    if (child.type === ComponentType.V2Section) {
      componentsV2.push(convertV2SectionToAPI(child as SectionComponent));
    } else if (child.type === ComponentType.V2ActionRow) {
      componentsV2.push(convertV2ActionRowToAPI(child as ActionRowComponent));
    } else if (child.type === ComponentType.V2Divider) {
      componentsV2.push(convertV2DividerToAPI(child as DividerComponent));
    }
  });

  if (componentsV2.length > 0) {
    details.componentsV2 = componentsV2;
  }

  // Clear legacy content when using V2
  details.content = "";
  details.embeds = [];
  details.componentRows = null;

  // Handle formatter options
  if (
    component.formatTables !== undefined ||
    component.stripImages !== undefined ||
    component.ignoreNewLines !== undefined
  ) {
    details.formatter = {
      formatTables: component.formatTables,
      stripImages: component.stripImages,
      ignoreNewLines: component.ignoreNewLines,
    };
  }

  // Handle placeholder fallback
  if (component.enablePlaceholderFallback !== undefined) {
    details.enablePlaceholderFallback = component.enablePlaceholderFallback;
  }

  // Handle shared options
  if (component.forumThreadTitle !== undefined) {
    details.forumThreadTitle = component.forumThreadTitle;
  }

  if (component.forumThreadTags) {
    details.forumThreadTags = component.forumThreadTags;
  }

  if (component.mentions !== undefined) {
    details.mentions = component.mentions;
  }

  if (component.placeholderLimits !== undefined) {
    details.placeholderLimits = component.placeholderLimits;
  }

  // Handle channel thread settings
  if (component.channelNewThreadTitle !== undefined) {
    details.channelNewThreadTitle = component.channelNewThreadTitle;
  }

  if (component.channelNewThreadExcludesPreview !== undefined) {
    details.channelNewThreadExcludesPreview = component.channelNewThreadExcludesPreview;
  }

  return details;
};

const convertLegacyRootToConnectionUpdate = (
  component: LegacyMessageComponentRoot
): UpdateDiscordChannelConnectionInput["details"] => {
  const details: UpdateDiscordChannelConnectionInput["details"] = {};

  const textComponent = component.children?.find((c) => c.type === ComponentType.LegacyText) as
    | LegacyTextComponent
    | undefined;

  if (typeof textComponent?.content === "string" && !!textComponent?.content) {
    details.content = textComponent.content;
  } else {
    details.content = "";
  }

  // Handle embeds from LegacyEmbedContainerComponent
  const embedContainer = component.children?.find((c: any) => c.type === "Legacy Embed Container");

  if (embedContainer) {
    details.embeds = embedContainer.children?.map((embed: any) => {
      const embedDetails: any = {};

      if (embed.color) {
        embedDetails.color = embed.color.toString(16).padStart(6, "0");
      }

      // Handle author
      const author = embed.children?.find((c: any) => c.type === "Embed Author");

      if (author) {
        embedDetails.author = {
          name: author.authorName,
          url: author.authorUrl,
          iconUrl: author.authorIconUrl,
        };
      }

      // Handle title
      const title = embed.children?.find((c: any) => c.type === "Embed Title");

      if (title) {
        embedDetails.title = title.title;
        embedDetails.url = title.titleUrl;
      }

      // Handle description
      const description = embed.children?.find((c: any) => c.type === "Embed Description");

      if (description) {
        embedDetails.description = description.description;
      }

      // Handle fields
      const fields = embed.children?.filter((c: any) => c.type === "Embed Field");

      if (fields?.length) {
        embedDetails.fields = fields.map((field: any) => ({
          name: field.fieldName,
          value: field.fieldValue,
          inline: field.inline,
        }));
      }

      // Handle image
      const image = embed.children?.find((c: any) => c.type === "Embed Image");

      if (image) {
        embedDetails.image = { url: image.imageUrl };
      }

      // Handle thumbnail
      const thumbnail = embed.children?.find((c: any) => c.type === "Embed Thumbnail");

      if (thumbnail) {
        embedDetails.thumbnail = { url: thumbnail.thumbnailUrl };
      }

      // Handle footer
      const footer = embed.children?.find((c: any) => c.type === "Embed Footer");

      if (footer) {
        embedDetails.footer = {
          text: footer.footerText,
          iconUrl: footer.footerIconUrl,
        };
      }

      // Handle timestamp
      const timestamp = embed.children?.find((c: any) => c.type === "Embed Timestamp");

      if (timestamp) {
        embedDetails.timestamp = timestamp.timestamp;
      }

      return embedDetails;
    });
  }

  // Handle action rows
  const actionRows = component.children?.filter((c) => c.type === ComponentType.LegacyActionRow) as
    | LegacyActionRowComponent[]
    | undefined;

  if (actionRows?.length) {
    details.componentRows = actionRows.map((row) => ({
      id: row.id,
      components:
        row.children?.map((button: LegacyButtonComponent) => ({
          id: button.id,
          type: 2, // Button type
          label: button.label,
          style: getButtonStyleNumber(button.style),
          url: button.url,
        })) || [],
    }));
  }

  // Clear V2 components when using legacy
  details.componentsV2 = null;

  // Handle formatter options
  if (component.formatTables !== undefined) {
    details.formatter = {
      ...details.formatter,
      formatTables: component.formatTables,
    };
  }

  if (component.stripImages !== undefined) {
    details.formatter = {
      ...details.formatter,
      stripImages: component.stripImages,
    };
  }

  if (component.ignoreNewLines !== undefined) {
    details.formatter = {
      ...details.formatter,
      ignoreNewLines: component.ignoreNewLines,
    };
  }

  // Handle shared options
  if (component.forumThreadTitle !== undefined) {
    details.forumThreadTitle = component.forumThreadTitle;
  }

  if (component.forumThreadTags) {
    details.forumThreadTags = component.forumThreadTags;
  }

  if (component.mentions !== undefined) {
    details.mentions = component.mentions;
  }

  if (component.placeholderLimits !== undefined) {
    details.placeholderLimits = component.placeholderLimits;
  }

  return details;
};

const convertMessageBuilderStateToConnectionUpdate = (
  component?: MessageComponentRoot
): UpdateDiscordChannelConnectionInput["details"] => {
  if (!component) return {};

  if (component.type === ComponentType.V2Root) {
    return convertV2RootToConnectionUpdate(component);
  }

  return convertLegacyRootToConnectionUpdate(component);
};

export default convertMessageBuilderStateToConnectionUpdate;

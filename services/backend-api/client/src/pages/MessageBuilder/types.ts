import { DiscordButtonStyle } from "./constants/DiscordButtonStyle";

export enum ComponentType {
  LegacyRoot = "Legacy Discord Message",
  LegacyText = "Legacy Text",
  LegacyEmbedContainer = "Legacy Embed Container",
  LegacyEmbed = "Legacy Embed",
  LegacyEmbedAuthor = "Embed Author",
  LegacyEmbedTitle = "Embed Title",
  LegacyEmbedDescription = "Embed Description",
  LegacyEmbedImage = "Embed Image",
  LegacyEmbedThumbnail = "Embed Thumbnail",
  LegacyEmbedFooter = "Embed Footer",
  LegacyEmbedField = "Embed Field",
  LegacyEmbedTimestamp = "Embed Timestamp",
  LegacyActionRow = "Legacy Action Row",
  LegacyButton = "Legacy Button",
  V2Root = "Discord Components V2",
  V2TextDisplay = "Text Display",
  V2ActionRow = "Action Row",
  V2Button = "Button",
  V2Section = "Section",
  V2Divider = "Divider",
  V2Thumbnail = "Thumbnail",
  V2Container = "Container",
}

export const ROOT_COMPONENT_TYPES = [ComponentType.LegacyRoot, ComponentType.V2Root];

export interface MessageBuilderProblem {
  message: string;
  path: string;
  componentId: string;
}

// Types for component tree
export interface BaseComponent {
  id: string;
  name: string;
  children?: Component[];
}

export type MessageComponentRoot = LegacyMessageComponentRoot | V2MessageComponentRoot;

export interface LegacyMessageComponentRoot extends BaseComponent {
  type: ComponentType.LegacyRoot;
  children: Component[];
  formatTables?: boolean;
  stripImages?: boolean;
  ignoreNewLines?: boolean;
  enablePlaceholderFallback?: boolean;
  forumThreadTitle?: string;
  forumThreadTags?: Array<{
    id: string;
    filters?: {
      expression: any;
    } | null;
  }> | null;
  isForumChannel?: boolean;
  channelNewThreadTitle?: string;
  channelNewThreadExcludesPreview?: boolean;
  mentions?: {
    targets?: Array<{
      type: "role" | "user";
      id: string;
      filters?: {
        expression: any;
      } | null;
    }> | null;
  } | null;
  placeholderLimits?: Array<{
    characterCount: number;
    placeholder: string;
    appendString?: string | null;
  }> | null;
}

export interface V2MessageComponentRoot extends BaseComponent {
  type: ComponentType.V2Root;
  children: Component[];
  formatTables?: boolean;
  stripImages?: boolean;
  ignoreNewLines?: boolean;
  enablePlaceholderFallback?: boolean;
  forumThreadTitle?: string;
  forumThreadTags?: Array<{
    id: string;
    filters?: {
      expression: any;
    } | null;
  }> | null;
  isForumChannel?: boolean;
  channelNewThreadTitle?: string;
  channelNewThreadExcludesPreview?: boolean;
  mentions?: {
    targets?: Array<{
      type: "role" | "user";
      id: string;
      filters?: {
        expression: any;
      } | null;
    }> | null;
  } | null;
  placeholderLimits?: Array<{
    characterCount: number;
    placeholder: string;
    appendString?: string | null;
  }> | null;
}

export interface TextDisplayComponent extends BaseComponent {
  type: ComponentType.V2TextDisplay;
  content: string;
}

export interface ButtonComponent extends BaseComponent {
  type: ComponentType.V2Button;
  label: string;
  style: DiscordButtonStyle;
  disabled: boolean;
  href?: string;
}

export interface ActionRowComponent extends BaseComponent {
  type: ComponentType.V2ActionRow;
  children: ButtonComponent[];
}

export interface ThumbnailComponent extends BaseComponent {
  type: ComponentType.V2Thumbnail;
  mediaUrl: string;
  description?: string;
  spoiler?: boolean;
}

export interface SectionComponent {
  type: ComponentType.V2Section;
  id: string;
  name: string;
  children: TextDisplayComponent[]; // max 3, only TextDisplay allowed
  accessory?: ButtonComponent | ThumbnailComponent; // required, only Button or Thumbnail allowed
}

export interface DividerComponent {
  type: ComponentType.V2Divider;
  id: string;
  name: string;
  visual?: boolean; // If a visual divider should be displayed (defaults to true)
  spacing?: 1 | 2; // Size of separator padding—1 for small padding, 2 for large padding. Defaults to 1
  children: [];
}

export type ContainerChildComponent =
  | DividerComponent
  | ActionRowComponent
  | SectionComponent
  | TextDisplayComponent;

export interface ContainerComponent {
  type: ComponentType.V2Container;
  id: string;
  name: string;
  accentColor?: number | null; // RGB color from 0x000000 to 0xFFFFFF
  spoiler?: boolean; // Whether container content should be blurred
  children: ContainerChildComponent[];
}

// Legacy Components
export interface LegacyTextComponent extends BaseComponent {
  type: ComponentType.LegacyText;
  content: string;
  disableImageLinkPreviews?: boolean;
  splitOptions?: {
    isEnabled?: boolean;
    splitChar?: string;
    appendChar?: string;
    prependChar?: string;
  };
}

export interface LegacyEmbedContainerComponent extends BaseComponent {
  type: ComponentType.LegacyEmbedContainer;
  children: LegacyEmbedComponent[];
}

export interface LegacyEmbedComponent extends BaseComponent {
  type: ComponentType.LegacyEmbed;
  children: Component[];
  color?: number;
}

export interface LegacyEmbedAuthorComponent extends BaseComponent {
  type: ComponentType.LegacyEmbedAuthor;
  authorName?: string;
  authorUrl?: string;
  authorIconUrl?: string;
}

export interface LegacyEmbedTitleComponent extends BaseComponent {
  type: ComponentType.LegacyEmbedTitle;
  title?: string;
  titleUrl?: string;
}

export interface LegacyEmbedDescriptionComponent extends BaseComponent {
  type: ComponentType.LegacyEmbedDescription;
  description?: string;
}

export interface LegacyEmbedImageComponent extends BaseComponent {
  type: ComponentType.LegacyEmbedImage;
  imageUrl?: string;
}

export interface LegacyEmbedThumbnailComponent extends BaseComponent {
  type: ComponentType.LegacyEmbedThumbnail;
  thumbnailUrl?: string;
}

export interface LegacyEmbedFooterComponent extends BaseComponent {
  type: ComponentType.LegacyEmbedFooter;
  footerText?: string;
  footerIconUrl?: string;
}

export interface LegacyEmbedFieldComponent extends BaseComponent {
  type: ComponentType.LegacyEmbedField;
  fieldName: string;
  fieldValue: string;
  inline?: boolean;
}

export interface LegacyEmbedTimestampComponent extends BaseComponent {
  type: ComponentType.LegacyEmbedTimestamp;
  timestamp?: "article" | "now" | "";
}

export interface LegacyActionRowComponent extends BaseComponent {
  type: ComponentType.LegacyActionRow;
  children: LegacyButtonComponent[];
}

export interface LegacyButtonComponent extends BaseComponent {
  type: ComponentType.LegacyButton;
  label: string;
  style: DiscordButtonStyle;
  disabled: boolean;
  url?: string;
}

export type Component =
  | LegacyMessageComponentRoot
  | V2MessageComponentRoot
  | TextDisplayComponent
  | ButtonComponent
  | ThumbnailComponent
  | ActionRowComponent
  | SectionComponent
  | DividerComponent
  | ContainerComponent
  | LegacyTextComponent
  | LegacyEmbedContainerComponent
  | LegacyEmbedComponent
  | LegacyEmbedAuthorComponent
  | LegacyEmbedTitleComponent
  | LegacyEmbedDescriptionComponent
  | LegacyEmbedImageComponent
  | LegacyEmbedThumbnailComponent
  | LegacyEmbedFooterComponent
  | LegacyEmbedFieldComponent
  | LegacyEmbedTimestampComponent
  | LegacyActionRowComponent
  | LegacyButtonComponent;

export interface ComponentTreeItemProps {
  component: Component;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string, childType: ComponentType) => void;
  depth?: number;
  onProblemsChange?: (problems: Array<{ message: string; path: string }>) => void;
}

export interface DiscordMessagePreviewProps {
  messageComponent: MessageComponentRoot | null;
}

export interface ComponentPropertiesPanelProps {
  selectedComponentId: string;
  hideTitle?: boolean;
  onDeleted?: () => void;
}

// Enums for component types
export const MESSAGE_ROOT_ID = "message-root" as const;

export enum ComponentType {
  LegacyRoot = "Legacy Discord Message",
  LegacyText = "Legacy Text",
  LegacyEmbed = "Legacy Embed",
  LegacyEmbedAuthor = "Embed Author",
  LegacyEmbedTitle = "Embed Title",
  LegacyEmbedDescription = "Embed Description",
  LegacyEmbedImage = "Embed Image",
  LegacyEmbedThumbnail = "Embed Thumbnail",
  LegacyEmbedFooter = "Embed Footer",
  LegacyEmbedField = "Embed Field",
  LegacyEmbedTimestamp = "Embed Timestamp",
  V2Root = "Discord Components V2",
  V2TextDisplay = "Text Display",
  V2ActionRow = "Action Row",
  V2Button = "Button",
  V2Section = "Section",
  V2Divider = "Divider",
}

export const ROOT_COMPONENT_TYPES = [ComponentType.LegacyRoot, ComponentType.V2Root];

export enum ButtonStyle {
  Primary = "Primary",
  Secondary = "Secondary",
  Success = "Success",
  Danger = "Danger",
  Link = "Link",
}

export interface PreviewerProblem {
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

export type PreviewerFormState = {
  messageComponent?: MessageComponentRoot;
};
export interface LegacyMessageComponentRoot extends BaseComponent {
  type: ComponentType.LegacyRoot;
  children: Component[];
}

export interface V2MessageComponentRoot extends BaseComponent {
  type: ComponentType.V2Root;
  children: Component[];
}

export interface TextDisplayComponent extends BaseComponent {
  type: ComponentType.V2TextDisplay;
  content: string;
}

export interface ButtonComponent extends BaseComponent {
  type: ComponentType.V2Button;
  label: string;
  style: ButtonStyle;
  disabled: boolean;
  href?: string;
}

export interface ActionRowComponent extends BaseComponent {
  type: ComponentType.V2ActionRow;
  children: ButtonComponent[];
}

export interface SectionComponent {
  type: ComponentType.V2Section;
  id: string;
  name: string;
  children: Component[]; // max 3, only TextDisplay allowed
  accessory?: Component; // required, only Button allowed
}

export interface DividerComponent {
  type: ComponentType.V2Divider;
  id: string;
  name: string;
  visual?: boolean; // If a visual divider should be displayed (defaults to true)
  spacing?: 1 | 2; // Size of separator padding—1 for small padding, 2 for large padding. Defaults to 1
  children: [];
}

// Legacy Components
export interface LegacyTextComponent extends BaseComponent {
  type: ComponentType.LegacyText;
  content: string;
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

export type Component =
  | LegacyMessageComponentRoot
  | LegacyTextComponent
  | LegacyEmbedComponent
  | LegacyEmbedAuthorComponent
  | LegacyEmbedTitleComponent
  | LegacyEmbedDescriptionComponent
  | LegacyEmbedImageComponent
  | LegacyEmbedThumbnailComponent
  | LegacyEmbedFooterComponent
  | LegacyEmbedFieldComponent
  | LegacyEmbedTimestampComponent
  | V2MessageComponentRoot
  | TextDisplayComponent
  | ActionRowComponent
  | ButtonComponent
  | SectionComponent
  | DividerComponent;

export interface ComponentTreeItemProps {
  component: Component;
  onDelete: (id: string) => void;
  onAddChild: (
    parentId: string,
    childType: ComponentType.V2TextDisplay | ComponentType.V2ActionRow | ComponentType.V2Button
  ) => void;
  depth?: number;
  onProblemsChange?: (problems: Array<{ message: string; path: string }>) => void;
}

export interface DiscordMessagePreviewProps {
  messageComponent: V2MessageComponentRoot | null;
}

export interface ComponentPropertiesPanelProps {
  selectedComponentId: string;
  hideTitle?: boolean;
}

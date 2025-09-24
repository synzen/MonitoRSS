import MessageComponentV2Root from "./components/MessageComponentV2Root";

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
  LegacyActionRow = "Legacy Action Row",
  LegacyButton = "Legacy Button",
  V2Root = "Discord Components V2",
  V2TextDisplay = "Text Display",
  V2ActionRow = "Action Row",
  V2Button = "Button",
  V2Section = "Section",
  V2Divider = "Divider",
}

// Types for component tree
// export interface BaseComponent {
//   id: string;
//   name: string;
//   children?: Component[];
// }

// export type MessageComponentRoot = LegacyMessageComponentRoot | V2MessageComponentRoot;

// export interface LegacyMessageComponentRoot extends BaseComponent {
//   type: ComponentType.LegacyRoot;
//   children: Component[];
// }

// export interface V2MessageComponentRoot extends BaseComponent {
//   type: ComponentType.V2Root;
//   children: Component[];
// }

// export interface TextDisplayComponent extends BaseComponent {
//   type: ComponentType.V2TextDisplay;
//   content: string;
// }

// export interface ButtonComponent extends BaseComponent {
//   type: ComponentType.V2Button;
//   label: string;
//   style: ButtonStyle;
//   disabled: boolean;
//   href?: string;
// }

// export interface ActionRowComponent extends BaseComponent {
//   type: ComponentType.V2ActionRow;
//   children: ButtonComponent[];
// }

// export interface SectionComponent {
//   type: ComponentType.V2Section;
//   id: string;
//   name: string;
//   children: Component[]; // max 3, only TextDisplay allowed
//   accessory?: Component; // required, only Button allowed
// }

// export interface DividerComponent {
//   type: ComponentType.V2Divider;
//   id: string;
//   name: string;
//   visual?: boolean; // If a visual divider should be displayed (defaults to true)

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
  messageComponent: MessageComponentV2Root | null;
}

export interface ComponentPropertiesPanelProps {
  selectedComponentId: string;
  hideTitle?: boolean;
}

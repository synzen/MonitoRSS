// Enums for component types
export const MESSAGE_ROOT_ID = "message-root" as const;

export enum ComponentType {
  Message = "message",
  TextDisplay = "text_display",
  ActionRow = "action_row",
  Button = "button",
  Section = "section",
  Divider = "divider",
}

export enum ButtonStyle {
  Primary = "Primary",
  Secondary = "Secondary",
  Success = "Success",
  Danger = "Danger",
  Link = "Link",
}

// Types for component tree
export interface BaseComponent {
  id: string;
  name: string;
  children?: Component[];
}

export interface MessageComponent extends BaseComponent {
  type: ComponentType.Message;
  children: (TextDisplayComponent | ActionRowComponent)[];
}

export interface TextDisplayComponent extends BaseComponent {
  type: ComponentType.TextDisplay;
  content: string;
}

export interface ButtonComponent extends BaseComponent {
  type: ComponentType.Button;
  label: string;
  style: ButtonStyle;
  disabled: boolean;
  href?: string;
}

export interface ActionRowComponent extends BaseComponent {
  type: ComponentType.ActionRow;
  children: ButtonComponent[];
}

export interface SectionComponent {
  type: ComponentType.Section;
  id: string;
  name: string;
  children: Component[]; // max 3, only TextDisplay allowed
  accessory?: Component; // required, only Button allowed
}

export interface DividerComponent {
  type: ComponentType.Divider;
  id: string;
  name: string;
  visual?: boolean; // If a visual divider should be displayed (defaults to true)
  spacing?: 1 | 2; // Size of separator padding—1 for small padding, 2 for large padding. Defaults to 1
  children: [];
}

export type Component =
  | MessageComponent
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
    childType: ComponentType.TextDisplay | ComponentType.ActionRow | ComponentType.Button
  ) => void;
  depth?: number;
  onProblemsChange?: (problems: Array<{ message: string; path: string }>) => void;
}

export interface DiscordMessagePreviewProps {
  messageComponent: MessageComponent | null;
}

export interface ComponentPropertiesPanelProps {
  selectedComponent: Component | null;
}

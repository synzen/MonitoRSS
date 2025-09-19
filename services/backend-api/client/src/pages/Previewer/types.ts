// Enums for component types
export const MESSAGE_ROOT_ID = "message-root" as const;

export enum ComponentType {
  Message = "Message",
  TextDisplay = "TextDisplay",
  ActionRow = "ActionRow",
  Button = "Button",
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

export type Component =
  | MessageComponent
  | TextDisplayComponent
  | ButtonComponent
  | ActionRowComponent;

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

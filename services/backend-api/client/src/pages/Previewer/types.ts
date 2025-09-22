// Enums for component types
export const MESSAGE_ROOT_ID = "message-root" as const;

export enum ComponentType {
  LegacyMessage = "Legacy Discord Message",
  V2Message = "Discord Components V2",
  V2TextDisplay = "Text Display",
  V2ActionRow = "Action Row",
  V2Button = "Button",
  V2Section = "Section",
  V2Divider = "Divider",
}

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

export interface MessageComponent extends BaseComponent {
  type: ComponentType.V2Message;
  children: (TextDisplayComponent | ActionRowComponent)[];
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
    childType: ComponentType.V2TextDisplay | ComponentType.V2ActionRow | ComponentType.V2Button
  ) => void;
  depth?: number;
  onProblemsChange?: (problems: Array<{ message: string; path: string }>) => void;
}

export interface DiscordMessagePreviewProps {
  messageComponent: MessageComponent | null;
}

export interface ComponentPropertiesPanelProps {
  selectedComponentId: string;
  hideTitle?: boolean;
}

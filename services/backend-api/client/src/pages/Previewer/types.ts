// Types for component tree
export interface BaseComponent {
  id: string;
  name: string;
  children?: Component[];
}

export interface MessageComponent extends BaseComponent {
  type: "Message";
  children: (TextDisplayComponent | ActionRowComponent)[];
}

export interface TextDisplayComponent extends BaseComponent {
  type: "TextDisplay";
  content: string;
}

export interface ButtonComponent extends BaseComponent {
  type: "Button";
  label: string;
  style: "Primary" | "Secondary" | "Success" | "Danger" | "Link";
  disabled: boolean;
  href?: string;
}

export interface ActionRowComponent extends BaseComponent {
  type: "ActionRow";
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
  onAddChild: (parentId: string, childType: "TextDisplay" | "ActionRow" | "Button") => void;
  depth?: number;
}

export interface DiscordMessagePreviewProps {
  messageComponent: MessageComponent | null;
}

export interface ComponentPropertiesPanelProps {
  selectedComponent: Component | null;
  onUpdateComponent: (id: string, updates: Partial<Component>) => void;
  onDeleteComponent: (id: string) => void;
}

import type { Article } from "../../articles/parser";
import type { LogicalExpression } from "../../articles/filters";
import type { SplitOptions, PlaceholderLimit } from "../../formatting/types";

// Re-export platform-agnostic types from formatting/
export {
  CustomPlaceholderStepType,
  type CustomPlaceholderStep,
  type CustomPlaceholder,
  type PlaceholderLimit,
  type SplitOptions,
  type FormatOptions,
  type ProcessCustomPlaceholdersResult,
  type GenerateTextOptions,
} from "../../formatting/types";

export interface FormatArticleForDiscordResult {
  article: Article;
  customPlaceholderPreviews: string[][];
}

// ============================================================================
// Discord Component Types
// ============================================================================

export enum DiscordComponentType {
  // Legacy components (numeric for backwards compatibility)
  ActionRow = 1,
  Button = 2,

  // V2 components (string enums for easier debugging)
  Section = "SECTION",
  TextDisplay = "TEXT_DISPLAY",
  Thumbnail = "THUMBNAIL",
  ActionRowV2 = "ACTION_ROW",
  ButtonV2 = "BUTTON",
  SeparatorV2 = "SEPARATOR",
  ContainerV2 = "CONTAINER",
  MediaGalleryV2 = "MEDIA_GALLERY",
}

export const DISCORD_COMPONENT_TYPE_TO_NUMBER = {
  [DiscordComponentType.Section]: 9,
  [DiscordComponentType.TextDisplay]: 10,
  [DiscordComponentType.Thumbnail]: 11,
  [DiscordComponentType.ActionRowV2]: 1,
  [DiscordComponentType.ButtonV2]: 2,
  [DiscordComponentType.SeparatorV2]: 14,
  [DiscordComponentType.ContainerV2]: 17,
  [DiscordComponentType.MediaGalleryV2]: 12,
} as const;

export const DISCORD_COMPONENTS_V2_FLAG = 1 << 15; // 32768

// ============================================================================
// V2 Component Output Types
// ============================================================================

export interface DiscordTextDisplayV2 {
  type: number;
  content: string;
}

export interface DiscordThumbnailV2 {
  type: number;
  media: {
    url: string;
  };
  description?: string | null;
  spoiler?: boolean;
}

export interface DiscordButtonV2 {
  type: number;
  custom_id?: string;
  style: number;
  label?: string;
  emoji?: {
    id: string;
    name?: string | null;
    animated?: boolean | null;
  } | null;
  url?: string | null;
  disabled?: boolean;
}

export interface DiscordSectionV2 {
  type: number;
  components: DiscordTextDisplayV2[];
  accessory: DiscordButtonV2 | DiscordThumbnailV2;
}

export interface DiscordActionRowV2 {
  type: number;
  components: DiscordButtonV2[];
}

export interface DiscordSeparatorV2 {
  type: number;
  divider?: boolean;
  spacing?: number;
}

export interface DiscordMediaGalleryItemV2 {
  media: {
    url: string;
  };
  description?: string | null;
  spoiler?: boolean;
}

export interface DiscordMediaGalleryV2 {
  type: number;
  items: DiscordMediaGalleryItemV2[];
}

export interface DiscordContainerV2 {
  type: number;
  accent_color?: number | null;
  spoiler?: boolean;
  components: DiscordMessageComponentV2[];
}

export type DiscordMessageComponentV2 =
  | DiscordSectionV2
  | DiscordActionRowV2
  | DiscordSeparatorV2
  | DiscordMediaGalleryV2
  | DiscordContainerV2;

// ============================================================================
// V1 Component Output Types
// ============================================================================

export interface DiscordMessageComponent {
  type: number;
  components: Array<{
    type: number;
    style: number;
    label: string;
    emoji?: {
      id: string;
      name?: string | null;
      animated?: boolean | null;
    } | null;
    url?: string | null;
  }>;
}

// ============================================================================
// Component Input Types
// ============================================================================

export interface ButtonInput {
  type: typeof DiscordComponentType.Button;
  style: number;
  label: string;
  emoji?: {
    id: string;
    name?: string | null;
    animated?: boolean | null;
  } | null;
  url?: string | null;
}

export interface ActionRowInput {
  type: typeof DiscordComponentType.ActionRow;
  components: ButtonInput[];
}

export interface TextDisplayV2Input {
  type: "TEXT_DISPLAY";
  content: string;
}

export interface ThumbnailV2Input {
  type: "THUMBNAIL";
  media: { url: string };
  description?: string | null;
  spoiler?: boolean;
}

export interface ButtonV2Input {
  type: "BUTTON";
  style: number;
  label?: string;
  emoji?: {
    id: string;
    name?: string | null;
    animated?: boolean | null;
  } | null;
  url?: string | null;
  disabled?: boolean;
}

export interface SectionV2Input {
  type: "SECTION";
  components: TextDisplayV2Input[];
  accessory: ButtonV2Input | ThumbnailV2Input;
}

export interface ActionRowV2Input {
  type: "ACTION_ROW";
  components: ButtonV2Input[];
}

export interface SeparatorV2Input {
  type: "SEPARATOR";
  divider?: boolean;
  spacing?: number;
}

export interface MediaGalleryItemV2Input {
  media: { url: string };
  description?: string | null;
  spoiler?: boolean;
}

export interface MediaGalleryV2Input {
  type: "MEDIA_GALLERY";
  items: MediaGalleryItemV2Input[];
}

export interface ContainerV2Input {
  type: "CONTAINER";
  accent_color?: number | null;
  spoiler?: boolean;
  components: ContainerChildV2Input[];
}

export type ContainerChildV2Input =
  | SeparatorV2Input
  | ActionRowV2Input
  | SectionV2Input
  | TextDisplayV2Input
  | MediaGalleryV2Input;

export type ComponentV2Input =
  | SectionV2Input
  | ActionRowV2Input
  | SeparatorV2Input
  | ContainerV2Input;

// ============================================================================
// Message Types
// ============================================================================

export interface MentionTarget {
  id: string;
  type: "user" | "role";
  filters?: {
    expression: LogicalExpression;
  };
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  footer?: { text?: string; iconUrl?: string };
  image?: { url?: string };
  thumbnail?: { url?: string };
  author?: { name?: string; url?: string; iconUrl?: string };
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  timestamp?: "now" | "article" | "";
}

export interface DiscordMessageApiPayload {
  content?: string;
  embeds?: Array<{
    title?: string;
    description?: string;
    url?: string;
    color?: number;
    footer?: { text: string; icon_url?: string };
    image?: { url: string };
    thumbnail?: { url: string };
    author?: { name: string; url?: string; icon_url?: string };
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
    timestamp?: string;
  }>;
  components?: DiscordMessageComponent[] | DiscordMessageComponentV2[];
  flags?: number;
}

export interface GeneratePayloadsOptions {
  content?: string;
  embeds?: DiscordEmbed[];
  splitOptions?: SplitOptions;
  placeholderLimits?: PlaceholderLimit[];
  enablePlaceholderFallback?: boolean;
  mentions?: { targets?: MentionTarget[] };
  components?: ActionRowInput[];
  componentsV2?: ComponentV2Input[];
}

export interface ForumThreadTag {
  id: string;
  filters?: {
    expression: LogicalExpression;
  };
}

export interface WebhookPayload extends DiscordMessageApiPayload {
  username?: string;
  avatar_url?: string;
}

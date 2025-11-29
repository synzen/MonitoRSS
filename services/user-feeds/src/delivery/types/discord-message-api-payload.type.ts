// V2 Components Flag
export const DISCORD_COMPONENTS_V2_FLAG = 1 << 15; // 32768

export interface DiscordMessageApiPayload {
  content?: string;
  embeds?: DiscordEmbed[];
  components?: DiscordMessageComponent[] | DiscordMessageComponentV2[];
  flags?: number;
}

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
// V2 Component Types
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
  custom_id: string;
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
// Embed Types
// ============================================================================

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string | null;
  color?: number;
  footer?: DiscordEmbedFooter;
  image?: DiscordEmbedImage;
  thumbnail?: DiscordEmbedThumbnail;
  author?: DiscordEmbedAuthor;
  fields?: DiscordEmbedField[];
  timestamp?: string;
}

export interface DiscordEmbedFooter {
  text: string;
  icon_url?: string | null;
}

export interface DiscordEmbedImage {
  url: string | null;
}

export interface DiscordEmbedThumbnail {
  url: string | null;
}

export interface DiscordEmbedAuthor {
  name: string;
  url?: string | null;
  icon_url?: string | null;
}

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

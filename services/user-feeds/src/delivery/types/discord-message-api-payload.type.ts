export interface DiscordMessageApiPayload {
  content?: string;
  embeds?: DiscordEmbed[];
}

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

import type { IFeedEmbed } from "./feed-embed.types";

export interface IFeedFilteredFormat {
  id: string;
  text?: string;
  embeds?: IFeedEmbed[];
  feedId: string;
  priority: number;
  filters?: Record<string, string[]>;
}

export interface IFeedFilteredFormatRepository {}

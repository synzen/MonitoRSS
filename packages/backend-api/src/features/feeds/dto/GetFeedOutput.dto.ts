export enum FeedEmbedTimestamp {
  ARTICLE = 'article',
  NOW = 'now',
}

export interface FeedEmbedOutputDto {
  title?: string;
  description?: string;
  url?: string;
  timestamp?: FeedEmbedTimestamp;
  footer?: {
    text?: string;
    iconUrl?: string;
  };
  thumbnail?: {
    url?: string;
  };
  image?: {
    url?: string;
  };
  author?: {
    name?: string;
    url?: string;
    iconUrl?: string;
  };
  color?: number;
  fields: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
}

interface FeedOutputDto {
  refreshRateSeconds: number;
  text: string;
  embeds: FeedEmbedOutputDto[];
  checkTitles?: boolean;
  checkDates?: boolean;
  imgPreviews?: boolean;
  imgLinksExistence?: boolean;
  formatTables?: boolean;
  directSubscribers?: boolean;
  disabled?: string;
  ncomparisons?: Array<string>;
  pcomparisons?: Array<string>;
}

export interface GetFeedOutputDto {
  result: FeedOutputDto;
}

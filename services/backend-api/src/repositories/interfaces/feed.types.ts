import type { IFeedEmbed, IFeedWebhook } from "./feed-embed.types";
import type { IFeedConnections } from "./feed-connection.types";

// FeedRegexOp
export interface IFeedRegexOpSearch {
  regex: string;
  flags?: string;
  match?: number;
  group?: number;
}

export interface IFeedRegexOp {
  name: string;
  search: IFeedRegexOpSearch;
  fallbackValue?: string;
  replacement?: string;
  replacementDirect?: string;
}

// FeedSplitOptions
export interface IFeedSplitOptions {
  enabled?: boolean;
  char?: boolean;
  prepend?: boolean;
  append?: boolean;
  maxLength?: boolean;
}

// Feed
export interface IFeed {
  id: string;
  text?: string;
  title: string;
  url: string;
  guild: string;
  channel: string;
  filters?: Record<string, string[]>;
  rfilters?: Record<string, string>;
  embeds: IFeedEmbed[];
  disabled?: string;
  checkTitles?: boolean;
  checkDates?: boolean;
  imgPreviews?: boolean;
  imgLinksExistence?: boolean;
  formatTables?: boolean;
  directSubscribers?: boolean;
  ncomparisons?: string[];
  pcomparisons?: string[];
  webhook?: IFeedWebhook;
  addedAt: Date;
  split?: IFeedSplitOptions;
  regexOps?: Record<string, IFeedRegexOp[]>;
  isFeedv2?: boolean;
  connections?: IFeedConnections;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IFeedWithFailRecord extends IFeed {
  failRecord?: {
    id: string;
    reason?: string;
    failedAt: Date;
    alerted: boolean;
  };
}

export interface IFeedRepository {
  aggregateWithFailRecords(options: {
    guildId: string;
    search?: string;
    skip: number;
    limit: number;
  }): Promise<IFeedWithFailRecord[]>;

  countByGuild(guildId: string, search?: string): Promise<number>;

  findById(id: string): Promise<IFeed | null>;

  findUnconvertedByGuilds(options: {
    guildIds: string[] | "*";
    conversionDisabledCodes: string[];
  }): Promise<IFeed[]>;

  updateById(
    id: string,
    update: Record<string, unknown>,
  ): Promise<IFeed | null>;
}

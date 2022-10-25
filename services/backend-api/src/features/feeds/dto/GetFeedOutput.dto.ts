import { DetailedFeed } from "../types/detailed-feed.type";

export enum FeedEmbedTimestamp {
  ARTICLE = "article",
  NOW = "now",
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
  color?: string;
  fields: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
}

interface FeedOutputDto {
  id: string;
  title: string;
  status: "ok" | "failed" | "disabled" | "failing";
  failReason?: string;
  disabledReason?: string;
  filters: Array<{ category: string; value: string }>;
  url: string;
  channel: string;
  createdAt: string;
  refreshRateSeconds: number;
  text: string;
  embeds: FeedEmbedOutputDto[];
  checkTitles: boolean;
  checkDates: boolean;
  imgPreviews: boolean;
  imgLinksExistence: boolean;
  formatTables: boolean;
  directSubscribers: boolean;
  splitMessage: boolean;
  ncomparisons: Array<string>;
  pcomparisons: Array<string>;
  webhook?: {
    id: string;
    name?: string;
    iconUrl?: string;
  };
}

export class GetFeedOutputDto {
  result: FeedOutputDto;

  static fromEntity(feed: DetailedFeed): GetFeedOutputDto {
    const resultSoFar: GetFeedOutputDto = {
      result: {
        id: feed._id.toHexString(),
        channel: feed.channel,
        createdAt: (feed.createdAt || feed.addedAt).toISOString(),
        status: feed.status,
        failReason: feed.failReason,
        disabledReason: feed.disabledReason,
        title: feed.title,
        url: feed.url,
        refreshRateSeconds: feed.refreshRateSeconds,
        text: feed.text || "",
        /**
         * The defaults for these booleans match the defaults on the public hosting of the bot.
         * While not ideal to hardcode, it's the easiest way to get this out quick without
         * duplicating config variables.
         */
        checkDates: feed.checkDates ?? true,
        checkTitles: feed.checkTitles || false,
        directSubscribers: feed.directSubscribers || false,
        formatTables: feed.formatTables || false,
        imgLinksExistence: feed.imgLinksExistence ?? true,
        imgPreviews: feed.imgPreviews ?? true,
        splitMessage: feed.split?.enabled || false,
        ncomparisons: feed.ncomparisons || [],
        pcomparisons: feed.pcomparisons || [],
        filters: this.getFeedFiltersDto(feed.filters),
        embeds: feed.embeds.map((embed) => ({
          title: embed.title,
          description: embed.description,
          url: embed.url,
          thumbnail: {
            url: embed.thumbnailURL,
          },
          author: {
            iconUrl: embed.authorIconURL,
            name: embed.authorName,
            url: embed.authorURL,
          },
          fields: embed.fields || [],
          color: embed.color,
          footer: {
            text: embed.footerText,
            iconUrl: embed.footerIconURL,
          },
          image: {
            url: embed.imageURL,
          },
          timestamp: embed.timestamp as FeedEmbedTimestamp,
        })),
      },
    };

    if (feed.webhook?.id) {
      resultSoFar.result.webhook = {
        id: feed.webhook.id,
        name: feed.webhook.name,
        iconUrl: feed.webhook.avatar,
      };
    }

    return resultSoFar;
  }

  static getFeedFiltersDto(
    feedFilters?: DetailedFeed["filters"]
  ): GetFeedOutputDto["result"]["filters"] {
    const filters: FeedOutputDto["filters"] = [];

    Object.entries(feedFilters || {}).forEach(([category, values]) => {
      values.forEach((value) => {
        filters.push({ category, value });
      });
    });

    filters.sort((a, b) => {
      return a.category.localeCompare(b.category);
    });

    return filters;
  }
}

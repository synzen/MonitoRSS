import { FeedWithRefreshRate } from '../types/FeedWithRefreshRate';

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
  id: string;
  title: string;
  status: 'ok' | 'failed';
  url: string;
  channel: string;
  createdAt: string;
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

export class GetFeedOutputDto {
  result: FeedOutputDto;

  static fromEntity(feed: FeedWithRefreshRate): GetFeedOutputDto {
    return {
      result: {
        id: feed._id.toHexString(),
        channel: feed.channel,
        createdAt: feed.addedAt.toISOString(),
        status: feed.status,
        title: feed.title,
        url: feed.url,
        refreshRateSeconds: feed.refreshRateSeconds,
        text: feed.text || '',
        checkDates: feed.checkDates,
        checkTitles: feed.checkTitles,
        directSubscribers: feed.directSubscribers,
        disabled: feed.disabled,
        formatTables: feed.formatTables,
        imgLinksExistence: feed.imgLinksExistence,
        imgPreviews: feed.imgPreviews,
        ncomparisons: feed.ncomparisons || [],
        pcomparisons: feed.pcomparisons || [],
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
  }
}

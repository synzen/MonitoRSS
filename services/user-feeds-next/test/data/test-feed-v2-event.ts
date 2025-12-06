import type { FeedV2Event } from "../../src/schemas";
import { MediumKey } from "../../src/constants";

// Use type assertion to avoid needing to provide all optional fields
const testFeedV2Event = {
  timestamp: Date.now(),
  debug: true,
  data: {
    articleDayLimit: 100,
    feed: {
      id: "6755bb6828cc1c723cf53880",
      blockingComparisons: [],
      passingComparisons: [],
      url: "https://www.some-feed.com/rss",
    },
    mediums: [
      {
        id: "medium-id",
        key: MediumKey.Discord,
        filters: null,
        details: {
          guildId: "1",
          channel: { id: "channel-1" },
          content: "{{title}}",
          embeds: [],
          webhook: null,
          components: null,
          componentsV2: null,
          customPlaceholders: [],
          enablePlaceholderFallback: false,
          formatter: {
            disableImageLinkPreviews: false,
            formatTables: false,
            ignoreNewLines: false,
            stripImages: false,
          },
          forumThreadTags: [],
          forumThreadTitle: null,
          channelNewThreadTitle: null,
          channelNewThreadExcludesPreview: false,
          mentions: null,
          placeholderLimits: null,
        },
      },
    ],
  },
} as FeedV2Event;

export default testFeedV2Event;

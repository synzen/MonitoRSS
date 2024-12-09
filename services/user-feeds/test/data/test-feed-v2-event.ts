import { FeedV2Event, MediumKey } from "../../src/shared";

const testFeedV2Event: FeedV2Event = {
  timestamp: new Date().getTime(),
  debug: true,
  data: {
    articleDayLimit: 1,
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
          channel: { id: "channel 1" },
          content: "1",
          embeds: [],
          webhook: null,
          components: [],
          customPlaceholders: [],
          enablePlaceholderFallback: false,
          formatter: {
            disableImageLinkPreviews: false,
            formatTables: false,
            ignoreNewLines: false,
            stripImages: false,
          },
          forumThreadTags: [],
          mentions: null,
          placeholderLimits: null,
        },
      },
    ],
  },
};

export default testFeedV2Event;

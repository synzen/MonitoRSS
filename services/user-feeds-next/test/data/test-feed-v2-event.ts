import type { FeedV2Event } from "../../src/schemas";
import { MediumKey } from "../../src/constants";
import { randomUUID } from "crypto";

// Use type assertion to avoid needing to provide all optional fields
const generateTestFeedV2Event = () =>
  ({
    timestamp: Date.now(),
    debug: true,
    data: {
      articleDayLimit: 100,
      feed: {
        id: `feed-${randomUUID()}`,
        blockingComparisons: [],
        passingComparisons: [],
        url: "https://www.some-feed.com/rss",
      },
      mediums: [
        {
          id: `medium-${randomUUID()}`,
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
  }) as FeedV2Event;

export default generateTestFeedV2Event;

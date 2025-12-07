import type { FeedV2Event } from "../../src/schemas";
import { MediumKey } from "../../src/constants";
import { randomUUID } from "crypto";

interface GenerateTestFeedV2EventOptions {
  feedUrl?: string;
  feedId?: string;
  mediumId?: string;
}

// Use type assertion to avoid needing to provide all optional fields
const generateTestFeedV2Event = (options?: GenerateTestFeedV2EventOptions) =>
  ({
    timestamp: Date.now(),
    debug: true,
    data: {
      articleDayLimit: 100,
      feed: {
        id: options?.feedId ?? `feed-${randomUUID()}`,
        blockingComparisons: [],
        passingComparisons: [],
        url: options?.feedUrl ?? "https://www.some-feed.com/rss",
      },
      mediums: [
        {
          id: options?.mediumId ?? `medium-${randomUUID()}`,
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

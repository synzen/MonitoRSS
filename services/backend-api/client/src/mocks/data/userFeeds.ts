import { UserFeed } from "@/features/feed";
import { UserFeedDisabledCode, UserFeedHealthStatus } from "../../features/feed/types";
import { FeedConnectionDisabledCode, FeedConnectionType } from "../../types";
import mockDiscordChannels from "./discordChannels";
import mockDiscordServers from "./discordServers";
import mockDiscordWebhooks from "./discordWebhooks";
import { UserFeedManagerStatus } from "../../constants";

const sampleFilters = {
  expression: {
    type: "LOGICAL",
    op: "AND",
    children: [
      {
        type: "RELATIONAL",
        op: "EQ",
        left: {
          type: "ARTICLE",
          value: "title",
        },
        right: {
          type: "STRING",
          value: "test",
        },
      },
    ],
  },
};

const mockUserFeeds: UserFeed[] = [
  {
    id: "1",
    sharedAccessDetails: {
      inviteId: "1",
    },
    title: "New York Times",
    url: "https://www.feed1.com",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    blockingComparisons: ["title", "description"],
    passingComparisons: ["author"],
    isLegacyFeed: true,
    formatOptions: {
      dateFormat: undefined,
      dateTimezone: "UTC",
    },
    shareManageOptions: {
      invites: [
        {
          id: "99",
          createdAt: new Date().toISOString(),
          discordUserId: "1",
          status: UserFeedManagerStatus.Pending,
        },
        {
          id: "98",
          createdAt: new Date().toISOString(),
          discordUserId: "1",
          status: UserFeedManagerStatus.Declined,
        },
        {
          id: "97",
          createdAt: new Date().toISOString(),
          discordUserId: "1",
          status: UserFeedManagerStatus.Accepted,
        },
      ],
    },
    connections: [
      {
        details: {
          channel: {
            id: mockDiscordChannels[0].id,
            guildId: mockDiscordServers[0].id,
          },
          embeds: [
            {
              title: "hello world",
              fields: [
                {
                  id: "1",
                  name: "test",
                  value: "test",
                  inline: true,
                },
                {
                  id: "2",
                  name: "test",
                  value: "test",
                  inline: true,
                },
                {
                  id: "3",
                  name: "name 2",
                  value: "value 2",
                  inline: false,
                },
                {
                  id: "4",
                  name: "name 3",
                  value: "value 3",
                },
              ],
            },
          ],
          formatter: {
            formatTables: false,
            stripImages: false,
          },
          placeholderLimits: [
            {
              characterCount: 100,
              placeholder: "description",
              appendString: "...",
            },
            {
              characterCount: 50,
              placeholder: "title",
              appendString: "...",
            },
          ],
        },
        rateLimits: [
          {
            id: "1",
            limit: 100,
            timeWindowSeconds: 60,
          },
        ],
        customPlaceholders: [
          {
            id: "customtitle",
            referenceName: "Custom Title",
            sourcePlaceholder: "title",
            steps: [
              {
                id: "1",
                regexSearch: "^(.*)$",
                replacementString: "xx",
              },
            ],
          },
        ],
        splitOptions: null,
        mentions: {
          targets: [
            {
              id: "1",
              type: "role",
              filters: sampleFilters,
            },
          ],
        },
        filters: sampleFilters,
        id: "1",
        disabledCode: FeedConnectionDisabledCode.MissingPermissions,
        key: FeedConnectionType.DiscordChannel,
        name: "Discord Channel 1",
      },
      {
        details: {
          webhook: {
            id: mockDiscordWebhooks[0].id,
            iconUrl: mockDiscordWebhooks[0].avatarUrl,
            name: mockDiscordWebhooks[0].name,
            guildId: mockDiscordServers[0].id,
          },
          embeds: [],
          formatter: {
            formatTables: false,
            stripImages: false,
          },
        },
        mentions: null,
        splitOptions: null,
        filters: null,
        id: "1a",
        key: FeedConnectionType.DiscordChannel,
        name: "Discord Webhook in Channel",
      },
      {
        details: {
          channel: {
            id: mockDiscordChannels[3].id,
            guildId: mockDiscordServers[0].id,
            type: "forum",
          },
          embeds: [],
          formatter: {
            formatTables: false,
            stripImages: false,
          },
        },
        mentions: null,
        splitOptions: null,
        filters: null,
        id: "2",
        disabledCode: FeedConnectionDisabledCode.Manual,
        key: FeedConnectionType.DiscordChannel,
        name: "Discord Forum 1",
      },
      {
        details: {
          embeds: [],
          webhook: {
            id: mockDiscordWebhooks[0].id,
            iconUrl: mockDiscordWebhooks[0].avatarUrl,
            name: mockDiscordWebhooks[0].name,
            guildId: mockDiscordServers[0].id,
          },
          formatter: {
            formatTables: false,
            stripImages: false,
          },
        },
        splitOptions: null,
        filters: null,
        mentions: null,
        id: "3",
        key: FeedConnectionType.DiscordWebhook,
        name: "Discord Webhook 1",
      },
      {
        details: {
          channel: {
            id: mockDiscordChannels[4].id,
            guildId: mockDiscordServers[0].id,
            type: "thread",
          },
          embeds: [],
          formatter: {
            formatTables: false,
            stripImages: false,
          },
        },
        splitOptions: null,
        filters: null,
        mentions: null,
        id: "5",
        key: FeedConnectionType.DiscordChannel,
        name: "Discord Thread 1",
      },
    ],
    healthStatus: UserFeedHealthStatus.Ok,
    disabledCode: UserFeedDisabledCode.FeedTooLarge,
    refreshRateSeconds: 60,
    userRefreshRateSeconds: 120,
  },
  {
    id: "2",
    sharedAccessDetails: undefined,
    shareManageOptions: undefined,
    title: "Yahoo News",
    url: "https://www.feed2.com",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    healthStatus: UserFeedHealthStatus.Failed,
    connections: [],
    disabledCode: UserFeedDisabledCode.Manual,
    refreshRateSeconds: 60,
    formatOptions: {
      dateFormat: undefined,
      dateTimezone: "UTC",
    },
  },
  {
    id: "3",
    shareManageOptions: undefined,
    sharedAccessDetails: undefined,
    title: "CNN",
    url: "https://www.feed3.com",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    healthStatus: UserFeedHealthStatus.Failing,
    connections: [],
    disabledCode: undefined,
    refreshRateSeconds: 60,
    formatOptions: {
      dateFormat: undefined,
      dateTimezone: "UTC",
    },
  },
];

// for (let i = 0; i < 100; i++) {
//   mockUserFeeds.push({
//     id: `${i + 4}`,
//     title: `Feed ${i + 4}`,
//     url: `https://www.feed${i + 4}.com`,
//     createdAt: new Date().toISOString(),
//     updatedAt: new Date().toISOString(),
//     healthStatus: UserFeedHealthStatus.Ok,
//     connections: [],
//     disabledCode: undefined,
//     refreshRateSeconds: 60,
//     formatOptions: {
//       dateFormat: undefined,
//       dateTimezone: "UTC",
//     },
//   });
// }

export default mockUserFeeds;

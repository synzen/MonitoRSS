import { UserFeed } from "@/features/feed";
import { UserFeedDisabledCode, UserFeedHealthStatus } from "../../features/feed/types";
import {
  DiscordComponentButtonStyle,
  DiscordComponentType,
  FeedConnectionDisabledCode,
  FeedConnectionType,
} from "../../types";
import mockDiscordChannels from "./discordChannels";
import mockDiscordServers from "./discordServers";
import mockDiscordWebhooks from "./discordWebhooks";
import { CustomPlaceholderStepType, UserFeedManagerStatus } from "../../constants";

/**
 * Mock state configuration for connections testing.
 * Change this value to test different UI states:
 * - 'normal': Shows connections (default)
 * - 'no-connections': Removes all connections (tests no-connection state)
 */
type MockConnectionsState = "normal" | "no-connections";
export const MOCK_CONNECTIONS_STATE: MockConnectionsState = "normal";

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
          value: "id",
        },
        right: {
          type: "STRING",
          value: "IS-UPDATED",
        },
      },
    ],
  },
};

const mockUserFeeds: UserFeed[] = [
  {
    id: "empty-feed",
    title: "[Test] Empty Feed (No Articles)",
    url: "https://www.empty-feed-test.com/rss",
    createdAt: new Date().toISOString(),
    inputUrl: "https://www.empty-feed-test.com/rss",
    updatedAt: new Date().toISOString(),
    externalProperties: [],
    refreshRateOptions: [{ rateSeconds: 600 }],
    blockingComparisons: [],
    passingComparisons: [],
    isLegacyFeed: false,
    formatOptions: {
      dateFormat: undefined,
      dateTimezone: "UTC",
    },
    shareManageOptions: {
      invites: [],
    },
    connections: [
      {
        id: "empty-conn-1",
        name: "Empty Feed Connection",
        key: FeedConnectionType.DiscordChannel,
        details: {
          channel: {
            id: mockDiscordChannels[0].id,
            guildId: mockDiscordServers[0].id,
          },
          embeds: [],
          formatter: {
            formatTables: false,
            stripImages: false,
          },
        },
        filters: null,
        splitOptions: null,
        mentions: null,
      },
    ],
    healthStatus: UserFeedHealthStatus.Ok,
    disabledCode: undefined,
    userRefreshRateSeconds: 600,
    refreshRateSeconds: 600,
  },
  {
    id: "1f",
    title: "New York Times",
    url: "https://www.feed1.com",
    createdAt: new Date().toISOString(),
    inputUrl: "https://www.google.com",
    updatedAt: new Date().toISOString(),
    externalProperties: [
      {
        id: "1",
        sourceField: "url",
        label: "field1",
        cssSelector: "#title",
      },
      {
        id: "1a",
        sourceField: "url",
        label: "field2",
        cssSelector: "#description",
      },
      {
        id: "2",
        sourceField: "image::url",
        label: "field3",
        cssSelector: "#title",
      },
      {
        id: "2a",
        sourceField: "image::url",
        label: "field4",
        cssSelector: "#description",
      },
    ],
    refreshRateOptions: [
      {
        rateSeconds: 600,
      },
      {
        rateSeconds: 120,
        disabledCode: "NON_SUPPORTER",
      },
    ],
    blockingComparisons: ["title", "description"],
    passingComparisons: ["author"],
    formatOptions: {
      dateFormat: undefined,
      dateTimezone: "UTC",
    },
    shareManageOptions: {
      invites: [
        {
          id: "99",
          createdAt: new Date().toISOString(),
          discordUserId: "2",
          status: UserFeedManagerStatus.Pending,
        },
        {
          id: "98",
          createdAt: new Date().toISOString(),
          discordUserId: "3",
          status: UserFeedManagerStatus.Declined,
        },
        {
          id: "97",
          createdAt: new Date().toISOString(),
          discordUserId: "4",
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
          componentRows: [
            {
              id: "r1",
              components: [
                {
                  id: "b2",
                  type: DiscordComponentType.Button,
                  label: "Link Label",
                  style: DiscordComponentButtonStyle.Link,
                  url: "https://www.google.com",
                },
                {
                  id: "b1",
                  type: DiscordComponentType.Button,
                  label: "Danger Label",
                  style: DiscordComponentButtonStyle.Link,
                  url: "https://www.google.com",
                },
                {
                  id: "b3",
                  type: DiscordComponentType.Button,
                  label: "Link Label",
                  style: DiscordComponentButtonStyle.Link,
                  url: "https://www.google.com",
                },
                {
                  id: "b4",
                  type: DiscordComponentType.Button,
                  label: "Danger Label",
                  style: DiscordComponentButtonStyle.Link,
                  url: "https://www.google.com",
                },
              ],
            },
            {
              id: "r2",
              components: [
                {
                  id: "r2b2",
                  type: DiscordComponentType.Button,
                  label: "Link Label",
                  style: DiscordComponentButtonStyle.Link,
                  url: "https://www.google.com",
                },
              ],
            },
          ],
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
                type: CustomPlaceholderStepType.Regex,
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
        disabledCode: FeedConnectionDisabledCode.NotPaidSubscriber,
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
        },
        mentions: null,
        splitOptions: null,
        filters: null,
        id: "forum",
        disabledCode: FeedConnectionDisabledCode.Manual,
        key: FeedConnectionType.DiscordChannel,
        name: "Discord Forum 1",
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
      {
        details: {
          channel: {
            id: mockDiscordChannels[4].id,
            guildId: mockDiscordServers[0].id,
            type: "new-thread",
          },

          componentRows: [
            {
              id: "r1",
              components: [
                {
                  id: "b2",
                  type: DiscordComponentType.Button,
                  label: "Link Label",
                  style: DiscordComponentButtonStyle.Link,
                  url: "https://www.google.com",
                },
                {
                  id: "b1",
                  type: DiscordComponentType.Button,
                  label: "Danger Label",
                  style: DiscordComponentButtonStyle.Link,
                  url: "https://www.google.com",
                },
                {
                  id: "b3",
                  type: DiscordComponentType.Button,
                  label: "Link Label",
                  style: DiscordComponentButtonStyle.Link,
                  url: "https://www.google.com",
                },
                {
                  id: "b4",
                  type: DiscordComponentType.Button,
                  label: "Danger Label",
                  style: DiscordComponentButtonStyle.Link,
                  url: "https://www.google.com",
                },
              ],
            },
            {
              id: "r2",
              components: [
                {
                  id: "r2b2",
                  type: DiscordComponentType.Button,
                  label: "Link Label",
                  style: DiscordComponentButtonStyle.Link,
                  url: "https://www.google.com",
                },
              ],
            },
          ],
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
        },
        splitOptions: null,
        filters: null,
        mentions: null,
        id: "6",
        key: FeedConnectionType.DiscordChannel,
        name: "Discord New Thread 1",
      },
      {
        details: {
          channel: {
            id: mockDiscordChannels[4].id,
            guildId: mockDiscordServers[0].id,
            type: "forum-thread",
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
        },
        splitOptions: null,
        filters: null,
        mentions: null,
        id: "7",
        key: FeedConnectionType.DiscordChannel,
        name: "Discord Forum Thread 1",
      },
    ],
    healthStatus: UserFeedHealthStatus.Ok,
    disabledCode: UserFeedDisabledCode.FailedRequests,
    refreshRateSeconds: 60,
    userRefreshRateSeconds: 120,
  },
  {
    id: "2f",
    sharedAccessDetails: undefined,
    shareManageOptions: undefined,
    title: "Yahoo News",
    url: "https://www.feed2.com",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    refreshRateOptions: [],
    healthStatus: UserFeedHealthStatus.Failed,
    passingComparisons: ["title", "description"],
    connections: [],
    disabledCode: UserFeedDisabledCode.Manual,
    refreshRateSeconds: 60,
    formatOptions: {
      dateFormat: undefined,
      dateTimezone: "UTC",
    },
  },
  {
    id: "3f",
    shareManageOptions: undefined,
    sharedAccessDetails: undefined,
    title: "CNN",
    url: "https://www.feed3.com",
    refreshRateOptions: [],
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

// for (let i = 0; i < 100; i += 1) {
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
//     refreshRateOptions: [],
//   });
// }

export const getMockUserFeeds = (): UserFeed[] => {
  if ((MOCK_CONNECTIONS_STATE as MockConnectionsState) === "no-connections") {
    return mockUserFeeds.map((feed) => ({
      ...feed,
      connections: [],
    }));
  }

  return mockUserFeeds;
};

export default mockUserFeeds;

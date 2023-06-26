import { UserFeed } from "@/features/feed";
import { UserFeedDisabledCode, UserFeedHealthStatus } from "../../features/feed/types";
import { FeedConnectionDisabledCode, FeedConnectionType } from "../../types";
import mockDiscordChannels from "./discordChannels";
import mockDiscordServers from "./discordServers";
import mockDiscordWebhooks from "./discordWebhooks";

const mockUserFeeds: UserFeed[] = [
  {
    id: "1",
    title: "New York Times",
    url: "https://www.feed1.com",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    blockingComparisons: ["title", "description"],
    passingComparisons: ["author"],
    formatOptions: {
      dateFormat: undefined,
      dateTimezone: "UTC",
    },
    connections: [
      {
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
        splitOptions: null,
        filters: null,
        id: "1",
        disabledCode: FeedConnectionDisabledCode.MissingPermissions,
        key: FeedConnectionType.DiscordChannel,
        name: "Discord Channel 1",
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
        splitOptions: null,
        filters: null,
        id: "2",
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
        id: "5",
        key: FeedConnectionType.DiscordChannel,
        name: "Discord Thread 1",
      },
    ],
    healthStatus: UserFeedHealthStatus.Failed,
    disabledCode: UserFeedDisabledCode.FailedRequests,
    refreshRateSeconds: 60,
  },
  {
    id: "2",
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

export default mockUserFeeds;

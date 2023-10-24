import { FeedConnection, FeedConnectionType } from "@/types";
import mockDiscordChannels from "./discordChannels";
import mockDiscordServers from "./discordServers";

export const mockFeedChannelConnections: FeedConnection[] = [
  {
    id: "1",
    filters: null,
    name: "discord-channel-connection-1",
    details: {
      embeds: [],
      channel: {
        id: mockDiscordChannels[0].id,
        guildId: mockDiscordServers[0].id,
      },
      formatter: {
        formatTables: false,
        stripImages: false,
      },
      content: "test",
    },
    splitOptions: {},
    key: FeedConnectionType.DiscordChannel,
    mentions: null,
  },
];

import { DiscordMeUser } from "@/features/discordUser";

const mockDiscordUserMe: DiscordMeUser = {
  id: "1",
  username: "My name".padEnd(1000, "nasd"),
  iconUrl: undefined,
  maxFeeds: 10,
  maxUserFeeds: 5,
  supporter: {
    expireAt: new Date().toISOString(),
    guilds: [],
    maxFeeds: 10,
    maxGuilds: 10,
  },
};

export default mockDiscordUserMe;

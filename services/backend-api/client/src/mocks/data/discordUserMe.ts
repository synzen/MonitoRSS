import { DiscordMeUser } from "@/features/discordUser";

const mockDiscordUserMe: DiscordMeUser = {
  id: "1",
  email: "email@email.com",
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
  maxUserFeedsComposition: {
    base: 10,
    legacy: 2,
  },
  refreshRates: [
    {
      rateSeconds: 600,
    },
    {
      rateSeconds: 120,
      disabledCode: "NON_SUPPORTER",
    },
  ],
};

export default mockDiscordUserMe;

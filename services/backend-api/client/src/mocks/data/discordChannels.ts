import { DiscordServerChannel } from "@/features/discordServers/types/DiscordServerChannel";

const mockDiscordChannels: DiscordServerChannel[] = [
  {
    id: "123",
    name: "general",
    category: {
      name: "category1",
    },
  },
  {
    id: "456",
    name: "random",
    category: {
      name: "category2",
    },
  },
  {
    id: "789",
    name: "random2",
    category: null,
  },
];

export default mockDiscordChannels;

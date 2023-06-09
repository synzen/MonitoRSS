import { DiscordServerChannel } from "@/features/discordServers/types/DiscordServerChannel";

const mockDiscordChannels: DiscordServerChannel[] = [
  {
    id: "123",
    name: "general",
    category: {
      name: "category1",
    },
    availableTags: null,
  },
  {
    id: "456",
    name: "random",
    category: {
      name: "category2",
    },
    availableTags: null,
  },
  {
    id: "789",
    name: "random2",
    category: null,
    availableTags: null,
  },
  {
    id: "forum",
    name: "forum",
    category: null,
    availableTags: [
      {
        id: "tag1",
        hasPermissionToUse: true,
        name: "name1",
        emojiName: "🙂",
      },
      {
        id: "tag2",
        hasPermissionToUse: false,
        name: "name2",
        emojiName: null,
      },
      {
        id: "tag3",
        hasPermissionToUse: true,
        name: "name3",
        emojiName: null,
      },
    ],
  },
];

export default mockDiscordChannels;

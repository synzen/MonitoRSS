import { DiscordServerMember } from "../../features/discordServers/types/DiscordServerMember";

const mockDiscordServerMembers: DiscordServerMember[] = [
  {
    id: "1",
    username: "User 1",
    avatarUrl: null,
    displayName: "User One",
  },
  {
    id: "2",
    username: "User 2",
    avatarUrl: "https://placehold.co/600x400/000000/FFFFFF/png",
    displayName: "User Two",
  },
  {
    id: "3",
    username: "User 3",
    avatarUrl: "https://placehold.co/600x400/EEE/31343C",
    displayName: "User Three",
  },
];

export default mockDiscordServerMembers;

export interface DiscordGuildMember {
  roles: string[];
  user: {
    id: string;
    username: string;
    avatar?: string;
  };
}

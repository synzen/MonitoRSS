export interface DiscordGuildMember {
  roles: string[];
  nick?: string | null;
  user: {
    id: string;
    username: string;
    avatar?: string;
  };
}

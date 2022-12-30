export interface GetMeOutputDto {
  id: string;
  username: string;
  iconUrl?: string;
  maxFeeds: number;
  maxUserFeeds: number;
  supporter?: {
    guilds: string[];
    maxFeeds: number;
    maxGuilds: number;
    expireAt?: Date;
  };
}

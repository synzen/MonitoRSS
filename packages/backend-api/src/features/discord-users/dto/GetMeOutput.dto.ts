export interface GetMeOutputDto {
  id: string;
  username: string;
  iconUrl?: string;
  supporter: {
    guilds: string[];
    maxFeeds: number;
    maxGuilds: number;
    expireAt?: Date;
  };
}

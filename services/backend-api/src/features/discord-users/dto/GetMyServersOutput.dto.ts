interface PartialUserGuild {
  id: string;
  name: string;
  iconUrl?: string;
  benefits: {
    maxFeeds: number;
    webhooks: boolean;
  };
}

export interface GetMyServersOutputDto {
  total: number;
  results: PartialUserGuild[];
}

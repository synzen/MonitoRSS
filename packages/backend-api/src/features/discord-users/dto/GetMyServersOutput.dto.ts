interface PartialUserGuild {
  id: string;
  name: string;
  icon?: string;
  iconUrl?: string;
}

export interface GetMyServersOutputDto {
  total: number;
  results: PartialUserGuild[];
}

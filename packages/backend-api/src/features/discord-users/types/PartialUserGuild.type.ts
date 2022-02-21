export interface PartialUserGuild {
  id: string;
  name: string;
  icon?: string;
  owner: boolean;
  permissions: number;
}

export type PartialUserGuildFormatted = PartialUserGuild & {
  iconUrl?: string;
};

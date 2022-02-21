export interface PartialUserGuild {
  id: string;
  name: string;
  icon?: string;
}

export type PartialUserGuildFormatted = PartialUserGuild & {
  iconUrl?: string;
};

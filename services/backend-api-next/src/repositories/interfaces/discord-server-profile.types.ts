export interface IDiscordServerProfile {
  id: string;
  dateFormat?: string;
  dateLanguage?: string;
  timezone?: string;
  locale?: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDiscordServerProfileRepository {}

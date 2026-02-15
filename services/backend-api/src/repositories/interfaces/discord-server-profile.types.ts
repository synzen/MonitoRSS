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

export interface IDiscordServerProfileRepository {
  findById(id: string): Promise<IDiscordServerProfile | null>;
  findOneAndUpdate(
    id: string,
    updates: Partial<
      Pick<IDiscordServerProfile, "dateFormat" | "dateLanguage" | "timezone">
    >,
    options: { upsert: boolean },
  ): Promise<IDiscordServerProfile>;
}

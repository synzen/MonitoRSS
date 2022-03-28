import { InferType, object, string } from 'yup';

export const DiscordServerSettingsSchema = object({
  dateFormat: string().required(),
  dateLanguage: string().required(),
  timezone: string().required(),
});

export type DiscordServerSettings = InferType<typeof DiscordServerSettingsSchema>;

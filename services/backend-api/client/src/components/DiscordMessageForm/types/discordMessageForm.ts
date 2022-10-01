import {
  array,
  InferType, number, object, string,
} from 'yup';

export const discordMessageEmbedFormSchema = object({
  embedColor: number().positive().max(16777215)
    .typeError('Must be a positive number less than 16777216'),
  embedAuthorTitle: string().max(256),
  embedAuthorUrl: string(),
  embedAuthorIconUrl: string(),
  embedTitle: string().max(256),
  embedUrl: string(),
  embedDescription: string().max(4096),
  embedThumbnailUrl: string(),
  embedImageUrl: string(),
  embedFooterText: string().max(2048),
  embedFooterIconUrl: string(),
});
export const discordMessageFormSchema = object({
  content: string().max(2000),
  embeds: array().of(discordMessageEmbedFormSchema),
});

export type DiscordMessageFormData = InferType<typeof discordMessageFormSchema>;
export type DiscordMessageEmbedFormData = InferType<typeof discordMessageEmbedFormSchema>;

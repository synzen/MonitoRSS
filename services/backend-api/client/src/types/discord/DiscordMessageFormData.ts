import {
  array,
  InferType, number, object, string,
} from 'yup';

export const discordMessageEmbedFormSchema = object().shape({
  embedColor: number().positive().max(16777215)
    .typeError('Must be a positive number less than 16777216'),
  embedAuthorTitle: string().max(256),
  embedAuthorUrl: string().when('embedAuthorTitle', ([embedAuthorTitle], schema) => {
    if (!embedAuthorTitle) {
      return schema.oneOf([''], 'Must be empty if there is no author title');
    }

    return schema;
  }),
  embedAuthorIconUrl: string().when('embedAuthorTitle', ([embedAuthorTitle], schema) => {
    if (!embedAuthorTitle) {
      return schema.oneOf([''], 'Must be empty if there is no author title');
    }

    return schema;
  }),
  embedTitle: string().max(256),
  embedUrl: string().when('embedTitle', ([embedTitle], schema) => {
    if (!embedTitle) {
      return schema.oneOf([''], 'Must be empty if there is no title');
    }

    return schema;
  }),
  embedDescription: string().max(4096),
  embedThumbnailUrl: string(),
  embedImageUrl: string(),
  embedFooterText: string().max(2048),
  embedFooterIconUrl: string().when('embedFooterText', ([embedFooterText], schema) => {
    if (!embedFooterText) {
      return schema.oneOf([''], 'Must be empty if there is no footer text');
    }

    return schema;
  }),
});

export const discordMessageFormSchema = object({
  content: string().max(2000),
  embeds: array().of(discordMessageEmbedFormSchema),
});

export type DiscordMessageFormData = InferType<typeof discordMessageFormSchema>;
export type DiscordMessageEmbedFormData = InferType<typeof discordMessageEmbedFormSchema>;

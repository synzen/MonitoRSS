import {
  array,
  InferType, object, string,
} from 'yup';

export const discordMessageEmbedFormSchema = object().shape({
  color: string().test(
    'color',
    'Must be a valid color',
    (v) => !v || (!!v && /^\d+$/.test(v) && Number(v) < 16777216),
  ).optional(),
  author: object({
    name: string().max(256),
    url: string().when('name', ([name], schema) => {
      if (!name) {
        return schema.oneOf([''], 'Must be empty if there is no author name');
      }

      return schema;
    }),
    iconUrl: string().when('name', ([name], schema) => {
      if (!name) {
        return schema.oneOf([''], 'Must be empty if there is no author name');
      }

      return schema;
    }),
  }).optional().nullable(),
  title: string().max(256),
  url: string().when('title', ([title], schema) => {
    if (!title) {
      return schema.oneOf([''], 'Must be empty if there is no title');
    }

    return schema;
  }),
  description: string().max(4096),
  thumbnail: object({
    url: string(),
  }).optional().nullable(),
  image: object({
    url: string(),
  }).optional().nullable(),
  footer: object({
    text: string().max(2048),
    iconUrl: string().when('text', ([text], schema) => {
      if (!text) {
        return schema.oneOf([''], 'Must be empty if there is no footer text');
      }

      return schema;
    }),
  }).optional().nullable(),
});

export const discordMessageFormSchema = object({
  content: string().max(2000),
  embeds: array().of(discordMessageEmbedFormSchema),
});

export type DiscordMessageFormData = InferType<typeof discordMessageFormSchema>;
export type DiscordMessageEmbedFormData = InferType<typeof discordMessageEmbedFormSchema>;

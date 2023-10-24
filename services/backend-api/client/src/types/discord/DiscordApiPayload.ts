import { array, boolean, number, object, string } from "yup";

const DiscordEmbedFooterSchema = object({
  text: string().required(),
  icon_url: string().optional().nullable().default(undefined),
});

const DiscordEmbedImageSchema = object({
  url: string().required().nullable(),
});

const DiscordEmbedThumbnailSchema = object({
  url: string().required().nullable(),
});

const DiscordEmbedAuthorSchema = object({
  name: string().required(),
  url: string().optional().nullable().default(undefined),
  icon_url: string().optional().nullable().default(undefined),
});

const DiscordEmbedFieldSchema = object({
  name: string().required(),
  value: string().required(),
  inline: boolean().optional().default(false),
});

const DiscordEmbedSchema = object({
  title: string().optional().nullable().default(undefined),
  description: string().optional().nullable().default(undefined),
  url: string().optional().nullable().default(undefined),
  color: number().optional().nullable().default(undefined),
  footer: DiscordEmbedFooterSchema.optional().nullable().default(undefined),
  image: DiscordEmbedImageSchema.optional().nullable().default(undefined),
  thumbnail: DiscordEmbedThumbnailSchema.optional().nullable().default(undefined),
  author: DiscordEmbedAuthorSchema.optional().nullable().default(undefined),
  fields: array(DiscordEmbedFieldSchema).optional().nullable().default(undefined),
  timestamp: string().optional().nullable().default(undefined),
});

const DiscordButtonSchema = object({
  type: number().required(),
  label: string().required("This is a required field"),
  style: number().required(),
  url: string(),
});

export const DiscordMessageApiPayloadSchema = object({
  content: string().optional().default(undefined),
  embeds: array(DiscordEmbedSchema).optional().default(undefined),
  components: array(
    object({
      type: number().required(),
      components: array(DiscordButtonSchema.required()).required().max(5),
    }).required()
  )
    .max(5)
    .nullable(),
});

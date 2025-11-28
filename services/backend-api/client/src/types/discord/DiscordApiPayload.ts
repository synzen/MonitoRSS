import { array, boolean, InferType, number, object, string } from "yup";

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

const DiscordComponentSchema = object({
  type: number().required(),
  components: array(
    object({
      type: number().required(),
      style: number().optional(),
      label: string().optional(),
      url: string().optional().nullable(),
      disabled: boolean().optional(),
      content: string().optional(),
    })
  ).optional(),
  accessory: object({
    type: number().required(),
    style: number().optional(),
    label: string().optional(),
    url: string().optional().nullable(),
    disabled: boolean().optional(),
    media: object({
      url: string().required(),
    }).optional(),
  })
    .optional()
    .nullable(),
  // Separator/Divider properties
  divider: boolean().optional(),
  spacing: number().optional(),
});

export const DiscordMessageApiPayloadSchema = object({
  content: string().optional().default(undefined),
  embeds: array(DiscordEmbedSchema).optional().default(undefined),
  components: array(DiscordComponentSchema).max(5).nullable().optional(),
  flags: number().optional().nullable(),
});

export type DiscordMessageApiPayload = InferType<typeof DiscordMessageApiPayloadSchema>;
export type DiscordApiComponent = InferType<typeof DiscordComponentSchema>;
export type DiscordApiComponentChild = NonNullable<DiscordApiComponent["components"]>[number];
export type DiscordApiAccessory = NonNullable<DiscordApiComponent["accessory"]>;

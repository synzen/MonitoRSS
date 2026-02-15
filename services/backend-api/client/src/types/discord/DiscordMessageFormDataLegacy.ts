import { array, InferType, object, string } from "yup";

export const discordMessageEmbedFormLegacySchema = object().shape({
  color: string()
    .nullable()
    .test(
      "color",
      "Must be a valid color",
      (v) => !v || (!!v && /^\d+$/.test(v) && Number(v) < 16777216),
    )
    .optional(),
  author: object({
    name: string().nullable().max(256),
    url: string()
      .nullable()
      .when("name", ([name], schema) => {
        if (!name) {
          return schema.oneOf(["", null, undefined], "Must be empty if there is no author name");
        }

        return schema;
      })
      .nullable(),
    iconUrl: string()
      .nullable()
      .when("name", ([name], schema) => {
        if (!name) {
          return schema.oneOf(["", null, undefined], "Must be empty if there is no author name");
        }

        return schema;
      }),
  })
    .optional()
    .nullable(),
  title: string().nullable().max(256),
  url: string()
    .nullable()
    .when("title", ([title], schema) => {
      if (!title) {
        return schema.oneOf(["", null, undefined], "Must be empty if there is no title");
      }

      return schema;
    }),
  description: string().nullable().max(4096),
  thumbnail: object({
    url: string().nullable(),
  })
    .optional()
    .nullable(),
  image: object({
    url: string().nullable(),
  })
    .optional()
    .nullable(),
  footer: object({
    text: string().nullable().max(2048),
    iconUrl: string()
      .nullable()
      .when("text", ([text], schema) => {
        if (!text) {
          return schema.oneOf(["", null, undefined], "Must be empty if there is no footer text");
        }

        return schema;
      }),
  })
    .optional()
    .nullable(),
  timestamp: string().oneOf(["article", "now", "", undefined]).optional().nullable(),
});

export const discordMessageFormLegacySchema = object({
  content: string().max(2000),
  embeds: array().of(discordMessageEmbedFormLegacySchema),
});

export type DiscordMessageFormDataLegacy = InferType<typeof discordMessageFormLegacySchema>;
export type DiscordMessageEmbedFormDataLegacy = InferType<
  typeof discordMessageEmbedFormLegacySchema
>;

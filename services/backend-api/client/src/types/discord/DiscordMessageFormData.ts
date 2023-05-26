import { array, boolean, InferType, object, string } from "yup";

export const discordMessageEmbedFormSchema = object().shape({
  color: string()
    .nullable()
    .test(
      "color",
      "Must be a valid color",
      (v) => !v || (!!v && /^\d+$/.test(v) && Number(v) < 16777216)
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
  title: string().max(256),
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

export const discordMessageFormSchema = object({
  content: string().max(2000),
  embeds: array().of(discordMessageEmbedFormSchema),
  forumThreadTitle: string().optional().max(100),
  splitOptions: object({
    isEnabled: boolean().optional().nullable(),
    splitChar: string().max(10).optional().nullable(),
    appendChar: string().max(10).optional().nullable(),
    prependChar: string().max(10).optional().nullable(),
  })
    .optional()
    .nullable()
    .default(null),
  formatter: object({
    stripImages: boolean().optional().nullable(),
    formatTables: boolean().optional().nullable(),
  })
    .optional()
    .nullable(),
});

export type DiscordMessageFormData = InferType<typeof discordMessageFormSchema>;
export type DiscordMessageEmbedFormData = InferType<typeof discordMessageEmbedFormSchema>;

import { array, boolean, object, string } from "yup";

export const FeedEmbedSchema = object({
  title: string().nullable(),
  description: string().nullable(),
  url: string().nullable(),
  timestamp: string().oneOf(["now", "article", ""]).nullable(),
  footer: object({
    text: string().nullable(),
    iconUrl: string().nullable(),
  }).nullable(),
  thumbnail: object({
    url: string().nullable(),
  }).nullable(),
  image: object({
    url: string().nullable(),
  }).nullable(),
  author: object({
    name: string().nullable(),
    url: string().nullable(),
    iconUrl: string().nullable(),
  }).nullable(),
  color: string().nullable(),
  fields: array(
    object({
      id: string().required(),
      name: string().required(),
      value: string().required(),
      inline: boolean().default(false),
    }),
  ).nullable(),
}).required();

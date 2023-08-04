import { array, boolean, object, string } from "yup";

export const FeedEmbedSchema = object({
  title: string().optional(),
  description: string().optional(),
  url: string().optional(),
  timestamp: string().oneOf(["now", "article", ""]).optional(),
  footer: object({
    text: string().optional(),
    iconUrl: string().optional(),
  }).optional(),
  thumbnail: object({
    url: string().optional(),
  }).optional(),
  image: object({
    url: string().optional(),
  }).optional(),
  author: object({
    name: string().optional(),
    url: string().optional(),
    iconUrl: string().optional(),
  }).optional(),
  color: string().optional(),
  fields: array(
    object({
      id: string().required(),
      name: string().required(),
      value: string().required(),
      inline: boolean().default(false).required(),
    })
  ).optional(),
}).required();

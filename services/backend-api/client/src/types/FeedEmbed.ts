import { array, boolean, object, string } from "yup";

export const FeedEmbedSchema = object({
  title: string().optional().nullable(),
  description: string().optional().nullable(),
  url: string().optional().nullable(),
  timestamp: string().oneOf(["now", "article", ""]).optional().nullable(),
  footer: object({
    text: string().optional().nullable(),
    iconUrl: string().optional().nullable(),
  })
    .optional()
    .nullable(),
  thumbnail: object({
    url: string().optional().nullable(),
  })
    .optional()
    .nullable(),
  image: object({
    url: string().optional().nullable(),
  })
    .optional()
    .nullable(),
  author: object({
    name: string().optional().nullable(),
    url: string().optional().nullable(),
    iconUrl: string().optional().nullable(),
  })
    .optional()
    .nullable(),
  color: string().optional(),
  fields: array(
    object({
      id: string().required().nullable(),
      name: string().required().nullable(),
      value: string().required().nullable(),
      inline: boolean().default(false).nullable(),
    })
  )
    .optional()
    .nullable(),
}).required();

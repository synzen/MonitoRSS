import * as z from 'zod'

export const FeedMeta = z.object({
  _id: z.string(),
  url: z.string(),
  channel: z.string()
})

export type FeedMetaType = z.infer<typeof FeedMeta>

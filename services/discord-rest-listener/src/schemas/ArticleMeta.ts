import * as z from 'zod'

export const ArticleMeta = z.object({
  _id: z.string()
})

export type ArticleMetaType = z.infer<typeof ArticleMeta>

import * as z from 'zod'

export const ApiMeta = z.object({
  url: z.string(),
  method: z.string(),
  body: z.any()
})

export type ApiMetaType = z.infer<typeof ApiMeta>

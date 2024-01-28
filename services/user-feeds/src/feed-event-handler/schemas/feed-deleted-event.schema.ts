import { z } from "zod";

export const feedDeletedEventSchema = z.object({
  data: z.object({
    feed: z.object({
      id: z.string(),
    }),
  }),
});

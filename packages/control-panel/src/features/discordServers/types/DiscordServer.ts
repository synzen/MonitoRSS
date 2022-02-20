import { z } from 'zod';

export const DiscordServerSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().optional(),
});

export type DiscordServer = z.infer<typeof DiscordServerSchema>;

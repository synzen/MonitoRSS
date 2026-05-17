import { z } from "zod";

/**
 * Published by: backend-api (supporter subscription changes)
 * Consumed by: backend-api (handler syncs Discord supporter roles)
 *
 * Currently same-service publish/consume; kept as a queue so role syncs are
 * decoupled from the originating request lifecycle.
 */
export const SyncSupporterDiscordRolesSchema = z.object({
  data: z.object({
    userId: z.string(),
  }),
});

export type SyncSupporterDiscordRolesPayload = z.infer<typeof SyncSupporterDiscordRolesSchema>;

import type { Config } from "../../config";
import type { IUser } from "../../repositories/interfaces/user.types";

/**
 * Whether a user is a site admin (read-everything troubleshooting access).
 *
 * BACKEND_API_ADMIN_USER_IDS may list either internal user ids or Discord ids:
 * an operator configuring admins knows their Discord id, not the runtime-minted
 * Mongo id, so both are honored. This is the single definition of "admin" — every
 * call site routes through it so the matching rule stays consistent.
 */
export function isAdminUser(
  config: Pick<Config, "BACKEND_API_ADMIN_USER_IDS">,
  user: Pick<IUser, "id" | "discordUserId">,
): boolean {
  return (
    config.BACKEND_API_ADMIN_USER_IDS.includes(user.id) ||
    config.BACKEND_API_ADMIN_USER_IDS.includes(user.discordUserId)
  );
}

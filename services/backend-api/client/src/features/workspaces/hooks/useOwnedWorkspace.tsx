import { Workspace } from "../types";

/**
 * The owned workspace a billing CTA should act on, or undefined. Centralizes the
 * `role === "owner"` predicate that several surfaces branch on, so the ownership
 * rule lives in one place rather than being hand-rolled at each call site.
 *
 * A user can own multiple workspaces. One that needs billing (never activated,
 * or cancelled) is where there is a billing step to take, so it is preferred as
 * the CTA target; otherwise the first owned workspace is returned. Boolean
 * callers ("does the user own any workspace?") just take `!!` of the result.
 */
export const findOwnedWorkspace = (workspaces: Workspace[] | undefined) => {
  const owned = workspaces?.filter((w) => w.role === "owner");

  return owned?.find((w) => w.needsBilling) ?? owned?.[0];
};

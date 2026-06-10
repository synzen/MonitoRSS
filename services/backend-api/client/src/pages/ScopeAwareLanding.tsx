import { Spinner } from "@chakra-ui/react";
import { Navigate } from "react-router-dom";
import { pages } from "../constants";
import { useUserMe } from "@/features/discordUser";
import { useIsWorkspacesEnabled, useWorkspace } from "@/features/workspaces";

/**
 * The "/" landing redirect. Restores the last-active scope recorded by
 * ScopeNavigationContainer: a valid, still-accessible workspace slug lands on that
 * workspace's feeds; anything else (no preference, feature off, unknown slug, or
 * revoked membership) silently falls back to personal feeds. Only this route
 * consults the preference — typed URLs and deep links are never rewritten.
 */
export const ScopeAwareLanding = () => {
  const { enabled, status: flagStatus } = useIsWorkspacesEnabled();
  const { data: userMe } = useUserMe();
  const lastActiveSlug = userMe?.result.preferences?.lastActiveWorkspaceSlug || undefined;
  const workspaceSlug = enabled && lastActiveSlug ? lastActiveSlug : undefined;
  // The same per-slug query WorkspaceScopeLayout validates with, so a successful
  // landing arrives at the workspace route with this result already cached.
  const { workspace, status: workspaceStatus } = useWorkspace({ workspaceSlug });

  if (flagStatus === "loading") {
    return <Spinner mt={24} />;
  }

  if (workspaceSlug) {
    if (workspaceStatus === "loading") {
      return <Spinner mt={24} />;
    }

    if (workspace) {
      return <Navigate to={pages.userFeeds({ workspaceSlug: workspace.slug })} replace />;
    }
  }

  return <Navigate to={pages.userFeeds()} replace />;
};

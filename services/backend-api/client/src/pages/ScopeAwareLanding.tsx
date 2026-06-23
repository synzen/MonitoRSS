import { Navigate } from "react-router-dom";
import { LoadingFallback } from "../components";
import { pages } from "../constants";
import { useUserMe } from "@/features/discordUser";
import { useWorkspace } from "@/features/workspaces";

/**
 * The "/" landing redirect. Restores the last-active scope recorded by
 * ScopeNavigationContainer: a valid, still-accessible workspace slug lands on that
 * workspace's feeds; anything else (no preference, unknown slug, or revoked
 * membership) silently falls back to personal feeds. Only this route consults the
 * preference — typed URLs and deep links are never rewritten.
 */
export const ScopeAwareLanding = () => {
  const { data: userMe, status: userStatus } = useUserMe();
  const lastActiveSlug = userMe?.result.preferences?.lastActiveWorkspaceSlug || undefined;
  const workspaceSlug = lastActiveSlug || undefined;
  // The same per-slug query WorkspaceScopeLayout validates with, so a successful
  // landing arrives at the workspace route with this result already cached.
  const { workspace, status: workspaceStatus } = useWorkspace({ workspaceSlug });

  if (userStatus === "loading") {
    return <LoadingFallback />;
  }

  if (workspaceSlug) {
    if (workspaceStatus === "loading") {
      return <LoadingFallback />;
    }

    if (workspace) {
      return <Navigate to={pages.userFeeds({ workspaceSlug: workspace.slug })} replace />;
    }
  }

  return <Navigate to={pages.userFeeds()} replace />;
};

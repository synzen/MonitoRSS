import { Suspense } from "react";
import { Navigate, Outlet, useParams } from "react-router-dom";
import { LoadingFallback } from "@/components";
import { pages } from "@/constants";
import { FeedScopeProvider } from "@/features/feed";
import RouteParams from "@/types/RouteParams";
import { usePaddleContext } from "@/features/subscriptionProducts";
import { CurrentWorkspaceProvider } from "../../contexts";
import { useIsWorkspacesEnabled, useWorkspace } from "../../hooks";

/**
 * The `/workspaces/:workspaceSlug` layout route. Gates on the workspaces feature flag,
 * validates `:workspaceSlug` via the authoritative per-workspace endpoint
 * (`GET /workspaces/:workspaceSlug` returns 404 for a non-member or unknown slug),
 * provides `CurrentWorkspaceContext`, and renders the scoped page via `<Outlet/>`.
 * Feature-disabled, error, or missing workspace all resolve to the not-found page.
 *
 * Validation uses the per-workspace query rather than the `useWorkspaces()` list because
 * the list is cached with `keepPreviousData` and would briefly hold a stale
 * (pre-creation) value right after creating a workspace — the fresh per-slug query has
 * no such race.
 */
export const WorkspaceScopeLayout = () => {
  const { workspaceSlug } = useParams<RouteParams>();
  const { enabled, status: flagStatus } = useIsWorkspacesEnabled();
  const { isConfigured: isPaddleConfigured } = usePaddleContext();
  const {
    workspace,
    status: workspaceStatus,
    error,
    refetch,
  } = useWorkspace({ workspaceSlug: enabled ? workspaceSlug : undefined });

  if (flagStatus === "loading") {
    return <LoadingFallback />;
  }

  if (!enabled) {
    return <Navigate to={pages.notFound()} replace />;
  }

  if (workspaceStatus === "loading") {
    return <LoadingFallback />;
  }

  if (error || !workspace) {
    return <Navigate to={pages.notFound()} replace />;
  }

  return (
    <CurrentWorkspaceProvider workspaceSlug={workspaceSlug}>
      {/* All feed queries, mutations, and links under a workspace route are
          workspace-scoped via this provider, so the personal feeds UI is reused
          verbatim. */}
      <FeedScopeProvider
        value={{
          workspaceId: workspace.id,
          workspaceSlug: workspace.slug,
          maxFeeds: workspace.maxFeeds,
          // Dormant = billing exists on this instance but the workspace has no
          // active subscription; feed UI swaps to activation prompts.
          workspaceDormant: isPaddleConfigured && !workspace.subscription,
          redditConnection: workspace.redditConnection
            ? {
                status: workspace.redditConnection.status as "ACTIVE" | "REVOKED",
                connectedByUserId: workspace.redditConnection.connectedBy.userId,
                connectedByDiscordUserId: workspace.redditConnection.connectedBy.discordUserId,
              }
            : null,
          refreshRedditConnection: refetch,
        }}
      >
        <Suspense fallback={<LoadingFallback />}>
          <Outlet />
        </Suspense>
      </FeedScopeProvider>
    </CurrentWorkspaceProvider>
  );
};

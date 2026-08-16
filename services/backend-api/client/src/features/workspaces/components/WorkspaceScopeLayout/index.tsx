import { ReactNode, Suspense } from "react";
import { Center, Spinner, VisuallyHidden } from "@chakra-ui/react";
import { Navigate, Outlet, useParams } from "react-router-dom";
import { pages } from "@/constants";
import { FeedScopeProvider } from "@/features/feed";
import RouteParams from "@/types/RouteParams";
import { usePaddleContext } from "@/features/subscriptionProducts";
import { CurrentWorkspaceProvider, JustConvertedWorkspaceProvider } from "../../contexts";
import { useRefetchFeedsOnWorkspaceActivation, useWorkspace } from "../../hooks";

/**
 * The `/workspaces/:workspaceSlug` layout route. Validates `:workspaceSlug` via the
 * authoritative per-workspace endpoint (`GET /workspaces/:workspaceSlug` returns 404
 * for a non-member or unknown slug), provides `CurrentWorkspaceContext`, and renders
 * the scoped page via `<Outlet/>`. Error or missing workspace resolves to the
 * not-found page.
 *
 * Validation uses the per-workspace query rather than the `useWorkspaces()` list because
 * the list is cached with `keepPreviousData` and would briefly hold a stale
 * (pre-creation) value right after creating a workspace — the fresh per-slug query has
 * no such race.
 */
export const WorkspaceScopeLayout = ({ header }: { header?: ReactNode }) => {
  const { workspaceSlug } = useParams<RouteParams>();
  const { isConfigured: isPaddleConfigured } = usePaddleContext();
  const { workspace, status: workspaceStatus, error, refetch } = useWorkspace({ workspaceSlug });

  // Hosted here (not in the dormant activation empty state) because that empty
  // state unmounts in the same transition the subscription lands, racing its
  // own refetch. This layout stays mounted across dormant -> active.
  useRefetchFeedsOnWorkspaceActivation({
    subscription: workspace?.subscription,
  });

  let redditConnection;

  if (workspace) {
    redditConnection = workspace.redditConnection
      ? {
          status: workspace.redditConnection.status as "ACTIVE" | "REVOKED",
          connectedByUserId: workspace.redditConnection.connectedBy.userId,
          connectedByDiscordUserId: workspace.redditConnection.connectedBy.discordUserId,
        }
      : null;
  }

  return (
    <CurrentWorkspaceProvider workspace={workspace}>
      {/* All feed queries, mutations, and links under a workspace route are
          workspace-scoped via this provider, so the personal feeds UI is reused
          verbatim. */}
      <FeedScopeProvider
        value={{
          workspaceId: workspace?.id,
          workspaceSlug: workspace?.slug ?? workspaceSlug,
          maxFeeds: workspace?.maxFeeds,
          // Dormant = billing exists on this instance but the workspace has no
          // active subscription; feed UI swaps to activation prompts.
          workspaceDormant: workspace ? isPaddleConfigured && !workspace.subscription : undefined,
          redditConnection,
          refreshRedditConnection: refetch,
        }}
      >
        {header}
        {workspaceStatus === "loading" && (
          <Center as="main" width="100%" mt={24} role="status" aria-live="polite" aria-busy="true">
            <VisuallyHidden>Loading workspace</VisuallyHidden>
            <Spinner aria-hidden="true" />
          </Center>
        )}
        {error && <Navigate to={pages.notFound()} replace />}
        {workspaceStatus !== "loading" && !error && !workspace && (
          <Navigate to={pages.notFound()} replace />
        )}
        {workspace && (
          <JustConvertedWorkspaceProvider>
            <Suspense
              fallback={
                <Center
                  as="main"
                  width="100%"
                  mt={24}
                  role="status"
                  aria-live="polite"
                  aria-busy="true"
                >
                  <VisuallyHidden>Loading workspace content</VisuallyHidden>
                  <Spinner aria-hidden="true" />
                </Center>
              }
            >
              <Outlet />
            </Suspense>
          </JustConvertedWorkspaceProvider>
        )}
      </FeedScopeProvider>
    </CurrentWorkspaceProvider>
  );
};

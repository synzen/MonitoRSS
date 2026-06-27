import { ReactElement, ReactNode, createContext, useContext, useMemo } from "react";
import { Spinner } from "@chakra-ui/react";
import { ErrorAlert } from "@/components/ErrorAlert";
import { useWorkspace } from "../hooks";
import { Workspace, WorkspaceRole } from "../types";

export interface CurrentWorkspace {
  id: string;
  name: string;
  slug: string;
  // The caller's role, or null for a site admin observing a workspace they are
  // not a member of (read-only). Consumers gate mutating UI on a specific role,
  // so null naturally yields no management affordances.
  myRole: WorkspaceRole | null;
  // The workspace's feed limit, used to render the feed-limit bar.
  maxFeeds?: number;
  // The workspace's own subscription state; null when unsubscribed (dormant
  // if billing is enabled).
  subscription?: Workspace["subscription"];
}

/**
 * `null` is the personal scope — no workspace is current. Mirrors `UserFeedContext`
 * but, unlike it, `useCurrentWorkspace()` does not throw outside a provider:
 * personal-scope pages legitimately render with no current workspace.
 */
const CurrentWorkspaceContext = createContext<CurrentWorkspace | null>(null);

export const CurrentWorkspaceProvider = ({
  workspaceSlug,
  children,
  loadingComponent,
  errorComponent,
}: {
  workspaceSlug?: string;
  children: ReactNode;
  loadingComponent?: ReactElement;
  errorComponent?: ReactElement;
}) => {
  const { workspace, status, error } = useWorkspace({ workspaceSlug });

  const value = useMemo<CurrentWorkspace | null>(
    () =>
      workspace
        ? {
            id: workspace.id,
            name: workspace.name,
            slug: workspace.slug,
            myRole: workspace.role,
            maxFeeds: workspace.maxFeeds,
            subscription: workspace.subscription,
          }
        : null,
    [workspace],
  );

  if (error) {
    return errorComponent || <ErrorAlert description={error.message} />;
  }

  if (status === "loading" || !workspace) {
    return loadingComponent || <Spinner />;
  }

  return (
    <CurrentWorkspaceContext.Provider value={value}>{children}</CurrentWorkspaceContext.Provider>
  );
};

export const useCurrentWorkspace = () => useContext(CurrentWorkspaceContext);

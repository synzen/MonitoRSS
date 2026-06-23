import { useEffect, useMemo } from "react";
import { matchPath, useLocation } from "react-router-dom";
import { ScopeLabelProvider } from "../contexts/ScopeLabelContext";
import { useDiscordAuthStatus, useUpdateUserMe, useUserMe } from "@/features/discordUser";
import { useWorkspaces } from "@/features/workspaces";

const getWorkspaceSlugFromPath = (pathname: string) =>
  matchPath("/workspaces/:workspaceSlug/*", pathname)?.params.workspaceSlug ??
  matchPath("/workspaces/:workspaceSlug", pathname)?.params.workspaceSlug;

const isPersonalFeedAreaPath = (pathname: string) =>
  pathname === "/feeds" || pathname.startsWith("/feeds/") || pathname === "/add-feeds";

/**
 * Pages-layer container mounted once around the route tree. Two scope-navigation
 * concerns live here so feature components never need cross-feature imports:
 *
 * 1. Provides the breadcrumb scope label (workspace name / "Personal", count-gated
 *    like the header switcher) via ScopeLabelContext.
 * 2. Records the last-active scope to `preferences.lastActiveWorkspaceSlug` so the
 *    "/" landing can restore it. Fire-and-forget: only scope-meaningful routes are
 *    recorded (feed areas and workspace routes; scope-neutral pages like /settings
 *    are skipped), failures are swallowed, and navigation is never blocked.
 */
export const ScopeNavigationContainer = ({ children }: { children: React.ReactNode }) => {
  const { pathname } = useLocation();
  const { data: authStatusData } = useDiscordAuthStatus();
  const authenticated = !!authStatusData?.authenticated;
  const { data: userMe } = useUserMe({ enabled: authenticated });
  // Workspaces are available to every signed-in user. Gated on auth so this
  // globally-mounted container never fires user queries for logged-out visitors.
  const isSignedIn = !!userMe?.result;
  const { workspaces } = useWorkspaces({ enabled: isSignedIn });
  const hasWorkspaces = (workspaces?.length ?? 0) > 0;
  const { mutateAsync: updateUserMe } = useUpdateUserMe();

  const pathWorkspaceSlug = getWorkspaceSlugFromPath(pathname);
  const activeWorkspace = pathWorkspaceSlug
    ? workspaces?.find((w) => w.slug === pathWorkspaceSlug)
    : undefined;

  const scopeLabel = useMemo(() => {
    if (!isSignedIn || !hasWorkspaces) {
      return undefined;
    }

    if (pathWorkspaceSlug) {
      return activeWorkspace?.name;
    }

    return "Personal";
  }, [isSignedIn, hasWorkspaces, pathWorkspaceSlug, activeWorkspace?.name]);

  const storedSlug = userMe?.result.preferences?.lastActiveWorkspaceSlug ?? null;
  // null records personal scope; undefined means the route is scope-neutral
  // (or an unknown workspace slug) and nothing should be recorded.
  let scopeToRecord: string | null | undefined;

  if (activeWorkspace) {
    scopeToRecord = activeWorkspace.slug;
  } else if (!pathWorkspaceSlug && isPersonalFeedAreaPath(pathname)) {
    scopeToRecord = null;
  }

  useEffect(() => {
    if (!isSignedIn || !hasWorkspaces || !userMe) {
      return;
    }

    if (scopeToRecord === undefined || scopeToRecord === storedSlug) {
      return;
    }

    updateUserMe({
      details: { preferences: { lastActiveWorkspaceSlug: scopeToRecord } },
    }).catch(() => {});
  }, [isSignedIn, hasWorkspaces, !!userMe, scopeToRecord, storedSlug]);

  return <ScopeLabelProvider value={scopeLabel}>{children}</ScopeLabelProvider>;
};

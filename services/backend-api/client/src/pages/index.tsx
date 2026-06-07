import { Route, Routes, Navigate } from "react-router-dom";
import * as Sentry from "@sentry/react";
import { Heading, Spinner, Stack } from "@chakra-ui/react";
import { Suspense } from "react";
import { RequireAuth } from "@/features/auth";
import { PageContentV2 } from "../components/PageContentV2";
import { AppHeader } from "./AppHeader";
import { pages } from "../constants";
import { FeedConnectionType } from "../types";
import { Loading } from "../components";
import { UserFeedStatusFilterProvider, MultiSelectUserFeedProvider } from "@/features/feed";
import { WorkspaceScopeLayout, InvitePage } from "@/features/workspaces";
import { NotFound } from "./NotFound";
import { SuspenseErrorBoundary } from "../components/SuspenseErrorBoundary";

import { lazyWithRetries } from "../utils/lazyImportWithRetry";

const MessageBuilder = lazyWithRetries(() =>
  import("./MessageBuilder").then(({ MessageBuilder: c }) => ({ default: c })),
);

const UserFeeds = lazyWithRetries(() =>
  import("./UserFeeds").then(({ UserFeeds: c }) => ({ default: c })),
);

const UserFeed = lazyWithRetries(() =>
  import("./UserFeed").then(({ UserFeed: c }) => ({ default: c })),
);

const ConnectionSettings = lazyWithRetries(() =>
  import("./ConnectionSettings").then(({ ConnectionSettings: c }) => ({
    default: c,
  })),
);

const AddUserFeeds = lazyWithRetries(() => import("./AddUserFeeds"));

const UserSettings = lazyWithRetries(() =>
  import("./UserSettings").then(({ UserSettings: c }) => ({ default: c })),
);

const Checkout = lazyWithRetries(() =>
  import("./Checkout").then(({ Checkout: c }) => ({ default: c })),
);

const WorkspaceSettingsPage = lazyWithRetries(() =>
  import("./WorkspaceSettings").then(({ WorkspaceSettingsPage: c }) => ({ default: c })),
);

const SentryRoutes = Sentry.withSentryReactRouterV6Routing(Routes);

const Pages: React.FC = () => (
  <SentryRoutes>
    <Route path={pages.notFound()} element={<NotFound />} />
    <Route path="/" element={<Navigate to={pages.userFeeds()} />} />
    <Route
      path={pages.checkout(":priceId")}
      element={
        <RequireAuth>
          <PageContentV2 header={<AppHeader invertBackground />}>
            <SuspenseErrorBoundary>
              <Suspense fallback={<Spinner mt={24} />}>
                <Checkout cancelUrl={pages.userFeeds()} />
              </Suspense>
            </SuspenseErrorBoundary>
          </PageContentV2>
        </RequireAuth>
      }
    />
    <Route
      path={pages.userSettings()}
      element={
        <RequireAuth>
          <PageContentV2 header={<AppHeader />}>
            <SuspenseErrorBoundary>
              <Suspense fallback={<Spinner mt={24} />}>
                <UserSettings />
              </Suspense>
            </SuspenseErrorBoundary>
          </PageContentV2>
        </RequireAuth>
      }
    />
    <Route
      path={pages.addFeeds()}
      element={
        <RequireAuth waitForUserFetch>
          <AppHeader invertBackground />
          <Suspense fallback={<Spinner mt={24} />}>
            <AddUserFeeds />
          </Suspense>
        </RequireAuth>
      }
    />
    <Route
      path={pages.userFeeds()}
      element={
        <RequireAuth waitForUserFetch>
          <AppHeader />
          <Suspense fallback={<Spinner mt={24} />}>
            <MultiSelectUserFeedProvider>
              <UserFeedStatusFilterProvider>
                <UserFeeds />
              </UserFeedStatusFilterProvider>
            </MultiSelectUserFeedProvider>
          </Suspense>
        </RequireAuth>
      }
    />
    <Route
      path={pages.userFeed(":feedId")}
      element={
        <RequireAuth>
          <PageContentV2 header={<AppHeader />}>
            <Suspense fallback={<Spinner mt={24} />}>
              <UserFeed />
            </Suspense>
          </PageContentV2>
        </RequireAuth>
      }
    />
    <Route
      path={pages.userFeedConnection({
        feedId: ":feedId",
        connectionType: FeedConnectionType.DiscordChannel,
        connectionId: ":connectionId",
      })}
      element={
        <RequireAuth>
          <PageContentV2 header={<AppHeader />}>
            <Suspense fallback={<Spinner mt={24} />}>
              <ConnectionSettings connectionType={FeedConnectionType.DiscordChannel} />
            </Suspense>
          </PageContentV2>
        </RequireAuth>
      }
    />
    <Route
      path={pages.messageBuilder({
        feedId: ":feedId",
        connectionId: ":connectionId",
        connectionType: FeedConnectionType.DiscordChannel,
      })}
      element={
        <RequireAuth>
          <SuspenseErrorBoundary>
            <Suspense
              fallback={
                <Stack alignItems="center" justifyContent="center" height="100%" gap="2rem">
                  <Loading size="xl" />
                  <Heading>Loading Message Builder...</Heading>
                </Stack>
              }
            >
              <MessageBuilder />
            </Suspense>
          </SuspenseErrorBoundary>
        </RequireAuth>
      }
    />
    {/* Workspace-scoped routes reuse the same page components as personal scope.
        WorkspaceScopeLayout provides the workspace + feed scope so feed queries,
        mutations, and links stay workspace-scoped. Each child renders its own header
        (mirroring the personal routes) so the message-builder route can be
        full-screen with no header, exactly like personal scope. */}
    <Route
      path="/workspaces/:workspaceSlug"
      element={
        <RequireAuth waitForUserFetch>
          <WorkspaceScopeLayout />
        </RequireAuth>
      }
    >
      <Route index element={<Navigate to="feeds" replace />} />
      <Route
        path="feeds"
        element={
          <>
            <AppHeader />
            <Suspense fallback={<Spinner mt={24} />}>
              <MultiSelectUserFeedProvider>
                <UserFeedStatusFilterProvider>
                  <UserFeeds />
                </UserFeedStatusFilterProvider>
              </MultiSelectUserFeedProvider>
            </Suspense>
          </>
        }
      />
      <Route
        path="add-feeds"
        element={
          <>
            <AppHeader invertBackground />
            <Suspense fallback={<Spinner mt={24} />}>
              <AddUserFeeds />
            </Suspense>
          </>
        }
      />
      <Route
        path="feeds/:feedId"
        element={
          <PageContentV2 header={<AppHeader />}>
            <Suspense fallback={<Spinner mt={24} />}>
              <UserFeed />
            </Suspense>
          </PageContentV2>
        }
      />
      <Route
        path="feeds/:feedId/discord-channel-connections/:connectionId"
        element={
          <PageContentV2 header={<AppHeader />}>
            <Suspense fallback={<Spinner mt={24} />}>
              <ConnectionSettings connectionType={FeedConnectionType.DiscordChannel} />
            </Suspense>
          </PageContentV2>
        }
      />
      <Route
        path="feeds/:feedId/discord-channel-connections/:connectionId/message-builder"
        element={
          <SuspenseErrorBoundary>
            <Suspense
              fallback={
                <Stack alignItems="center" justifyContent="center" height="100%" gap="2rem">
                  <Loading size="xl" />
                  <Heading>Loading Message Builder...</Heading>
                </Stack>
              }
            >
              <MessageBuilder />
            </Suspense>
          </SuspenseErrorBoundary>
        }
      />
      <Route
        path="settings"
        element={
          <>
            <AppHeader />
            <WorkspaceSettingsPage />
          </>
        }
      />
    </Route>
    {/* Invitation landing page. RequireAuth bootstraps a logged-out invitee
        through Discord OAuth and returns them here (the path is preserved via
        the OAuth state), so the link works whether or not they're signed in. */}
    <Route
      path={pages.workspaceInvite(":inviteId")}
      element={
        <RequireAuth waitForUserFetch>
          <PageContentV2 header={<AppHeader />}>
            <InvitePage />
          </PageContentV2>
        </RequireAuth>
      }
    />
    <Route path="*" element={<Navigate to="/not-found" />} />
  </SentryRoutes>
);

export default Pages;

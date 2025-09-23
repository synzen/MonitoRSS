import { Route, Routes, Navigate } from "react-router-dom";
import * as Sentry from "@sentry/react";
import { Spinner, Stack } from "@chakra-ui/react";
import { Suspense } from "react";
import Feed from "./Feed";
import FeedFilters from "./FeedFilters";
import FeedMessage from "./FeedMessage";
import FeedMiscOptions from "./FeedMiscOptions";
import FeedSubscribers from "./FeedSubscribers";
import Home from "./Home";
import ServerDasboard from "./ServerDashboard";
import Servers from "./Servers";
import { RequireAuth } from "@/features/auth";
import { PageContent } from "@/components/PageContent";
import { ServerSettings } from "./ServerSettings";
import FeedClone from "./FeedClone";
import FeedComparisons from "./FeedComparisons";
import Feeds from "./Feeds";
import { RequireDiscordServers } from "@/features/discordServers";
import { PageContentV2 } from "../components/PageContentV2";
import { UserFeeds } from "./UserFeeds";
import { UserFeed } from "./UserFeed";
import { ConnectionDiscordChannelSettings } from "./ConnectionDiscordChannelSettings";
import { pages } from "../constants";
import { FeedConnectionType } from "../types";
import UserFeedsFAQ from "./UserFeedsFAQ";
import { Loading, NewHeader } from "../components";
import { UserFeedStatusFilterProvider } from "../contexts";
import { NotFound } from "./NotFound";
import { SuspenseErrorBoundary } from "../components/SuspenseErrorBoundary";
import AddUserFeeds from "./AddUserFeeds";
import { MultiSelectUserFeedProvider } from "../contexts/MultiSelectUserFeedContext";
import { lazyWithRetries } from "../utils/lazyImportWithRetry";

const Previewer = lazyWithRetries(() =>
  import("./Previewer").then(({ Previewer: c }) => ({
    default: c,
  }))
);

const UserSettings = lazyWithRetries(() =>
  import("./UserSettings").then(({ UserSettings: c }) => ({
    default: c,
  }))
);

const Checkout = lazyWithRetries(() =>
  import("./Checkout").then(({ Checkout: c }) => ({
    default: c,
  }))
);

const SentryRoutes = Sentry.withSentryReactRouterV6Routing(Routes);

const Pages: React.FC = () => (
  <SentryRoutes>
    <Route path={pages.notFound()} element={<NotFound />} />
    <Route
      path="/"
      element={
        <RequireAuth waitForUserFetch>
          <Home />
        </RequireAuth>
      }
    />
    <Route
      path="/servers"
      element={
        <RequireAuth>
          <RequireDiscordServers>
            <Servers />
          </RequireDiscordServers>
        </RequireAuth>
      }
    />
    <Route
      path="/servers/:serverId"
      element={
        <RequireAuth>
          <RequireDiscordServers>
            <PageContent>
              <ServerDasboard />
            </PageContent>
          </RequireDiscordServers>
        </RequireAuth>
      }
    />
    <Route
      path="/servers/:serverId/settings"
      element={
        <RequireAuth>
          <RequireDiscordServers>
            <PageContent>
              <ServerSettings />
            </PageContent>
          </RequireDiscordServers>
        </RequireAuth>
      }
    />
    <Route
      path="/servers/:serverId/feeds"
      element={
        <RequireAuth>
          <RequireDiscordServers>
            <PageContent>
              <Feeds />
            </PageContent>
          </RequireDiscordServers>
        </RequireAuth>
      }
    />
    <Route
      path={pages.checkout(":priceId")}
      element={
        <RequireAuth>
          <PageContentV2 invertBackground>
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
          <PageContentV2>
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
          <NewHeader invertBackground />
          <AddUserFeeds />
        </RequireAuth>
      }
    />
    <Route
      path={pages.userFeeds()}
      element={
        <RequireAuth waitForUserFetch>
          <NewHeader />
          <MultiSelectUserFeedProvider>
            <UserFeedStatusFilterProvider>
              <UserFeeds />
            </UserFeedStatusFilterProvider>
          </MultiSelectUserFeedProvider>
        </RequireAuth>
      }
    />
    <Route
      path={pages.userFeedsFaq()}
      element={
        <RequireAuth>
          <PageContentV2 invertBackground>
            <UserFeedsFAQ />
          </PageContentV2>
        </RequireAuth>
      }
    />
    <Route
      path="/servers/:serverId/feeds/:feedId"
      element={
        <RequireAuth>
          <RequireDiscordServers>
            <PageContent requireFeed>
              <Feed />
            </PageContent>
          </RequireDiscordServers>
        </RequireAuth>
      }
    />
    <Route
      path={pages.userFeed(":feedId")}
      element={
        <RequireAuth>
          <PageContentV2>
            <UserFeed />
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
          <PageContentV2>
            <ConnectionDiscordChannelSettings />
          </PageContentV2>
        </RequireAuth>
      }
    />
    <Route
      path="/servers/:serverId/feeds/:feedId/message"
      element={
        <RequireAuth>
          <RequireDiscordServers>
            <PageContent requireFeed>
              <FeedMessage />
            </PageContent>
          </RequireDiscordServers>
        </RequireAuth>
      }
    />
    <Route
      path="/servers/:serverId/feeds/:feedId/filters"
      element={
        <RequireAuth>
          <RequireDiscordServers>
            <PageContent requireFeed>
              <FeedFilters />
            </PageContent>
          </RequireDiscordServers>
        </RequireAuth>
      }
    />
    <Route
      path="/servers/:serverId/feeds/:feedId/comparisons"
      element={
        <RequireAuth>
          <RequireDiscordServers>
            <PageContent requireFeed>
              <FeedComparisons />
            </PageContent>
          </RequireDiscordServers>
        </RequireAuth>
      }
    />
    <Route
      path="/servers/:serverId/feeds/:feedId/subscribers"
      element={
        <RequireAuth>
          <RequireDiscordServers>
            <PageContent requireFeed>
              <FeedSubscribers />
            </PageContent>
          </RequireDiscordServers>
        </RequireAuth>
      }
    />
    <Route
      path="/servers/:serverId/feeds/:feedId/misc-options"
      element={
        <RequireAuth>
          <RequireDiscordServers>
            <PageContent requireFeed>
              <FeedMiscOptions />
            </PageContent>
          </RequireDiscordServers>
        </RequireAuth>
      }
    />
    <Route
      path="/servers/:serverId/feeds/:feedId/clone"
      element={
        <RequireAuth>
          <RequireDiscordServers>
            <PageContent requireFeed>
              <FeedClone />
            </PageContent>
          </RequireDiscordServers>
        </RequireAuth>
      }
    />
    <Route
      path="/previewer"
      element={
        <RequireAuth>
          <SuspenseErrorBoundary>
            <Suspense
              fallback={
                <Stack alignItems="center" justifyContent="center" height="100%" spacing="2rem">
                  <Loading size="xl" />
                </Stack>
              }
            >
              <Previewer />
            </Suspense>
          </SuspenseErrorBoundary>
        </RequireAuth>
      }
    />
    <Route path="*" element={<Navigate to="/not-found" />} />
  </SentryRoutes>
);

export default Pages;

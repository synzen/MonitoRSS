import { Route, Routes, Navigate } from "react-router-dom";
import * as Sentry from "@sentry/react";
import { Heading, Spinner, Stack } from "@chakra-ui/react";
import { Suspense } from "react";
import { RequireAuth } from "@/features/auth";
import { PageContentV2 } from "../components/PageContentV2";
import { UserFeeds } from "./UserFeeds";
import { UserFeed } from "./UserFeed";
import { ConnectionDiscordChannelSettings } from "./ConnectionDiscordChannelSettings";
import { pages } from "../constants";
import { FeedConnectionType } from "../types";
import { Loading, NewHeader } from "../components";
import { UserFeedStatusFilterProvider } from "../contexts";
import { NotFound } from "./NotFound";
import { SuspenseErrorBoundary } from "../components/SuspenseErrorBoundary";
import AddUserFeeds from "./AddUserFeeds";
import { MultiSelectUserFeedProvider } from "../contexts/MultiSelectUserFeedContext";
import { lazyWithRetries } from "../utils/lazyImportWithRetry";
import { MessageBuilder } from "./MessageBuilder";

// const MessageBuilder = lazyWithRetries(() =>
//   import("./MessageBuilder").then(({ MessageBuilder: c }) => ({
//     default: c,
//   }))
// );

const UserSettings = lazyWithRetries(() =>
  import("./UserSettings").then(({ UserSettings: c }) => ({
    default: c,
  })),
);

const Checkout = lazyWithRetries(() =>
  import("./Checkout").then(({ Checkout: c }) => ({
    default: c,
  })),
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
                <Stack alignItems="center" justifyContent="center" height="100%" spacing="2rem">
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
    <Route path="*" element={<Navigate to="/not-found" />} />
  </SentryRoutes>
);

export default Pages;

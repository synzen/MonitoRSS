import { Route, Routes, Navigate } from "react-router-dom";
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
import { NewHeader } from "../components";
import { UserFeedStatusFilterProvider } from "../contexts";
import { NotFound } from "./NotFound";
import { UserSettings } from "./UserSettings";

const Pages: React.FC = () => (
  <Routes>
    <Route path={pages.notFound()} element={<NotFound />} />
    <Route path="/" element={<Home />} />
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
      path={pages.userSettings()}
      element={
        <RequireAuth>
          <PageContentV2 invertBackground>
            <UserSettings />
          </PageContentV2>
        </RequireAuth>
      }
    />
    <Route
      path={pages.userFeeds()}
      element={
        <RequireAuth>
          {/* <PageContentV2 invertBackground> */}
          <NewHeader invertBackground />
          <UserFeedStatusFilterProvider>
            <UserFeeds />
          </UserFeedStatusFilterProvider>
          {/* </PageContentV2> */}
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
          <PageContentV2 requireFeed>
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
    <Route path="*" element={<Navigate to="/not-found" />} />
  </Routes>
);

export default Pages;

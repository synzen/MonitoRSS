import { FeedConnectionType } from "../types";
import { UserFeedConnectionTabSearchParam } from "./userFeedConnectionTabSearchParam";
import { UserFeedTabSearchParam } from "./userFeedTabSearchParam";

const getConnectionPathByType = (type: FeedConnectionType) => {
  switch (type) {
    case FeedConnectionType.DiscordChannel:
      return "/discord-channel-connections";
    default:
      return "";
  }
};

/**
 * Forward-compatibility shell per ADR-005 (team scoping).
 * When teams ship, pass `{ teamId }` to scope a route to a team workspace.
 * Personal-scope routes (no `teamId`) stay unprefixed so existing bookmarks survive.
 */
export type RouteScope = { teamId?: string };

const scopePrefix = (scope?: RouteScope) => (scope?.teamId ? `/teams/${scope.teamId}` : "");

export const pages = {
  checkout: (priceId: string, feeds?: { quantity: number; priceId: string }) =>
    `/paddle-checkout/${priceId}?${feeds ? `feeds=${feeds.quantity},${feeds.priceId}` : ""}`,
  messageBuilder: (data: {
    feedId: string;
    connectionType: FeedConnectionType;
    connectionId: string;
    scope?: RouteScope;
  }) => `${pages.userFeedConnection(data)}/message-builder`,
  addFeeds: () => "/add-feeds",
  userSettings: () => "/settings",
  userFeeds: (scope?: RouteScope) => `${scopePrefix(scope)}/feeds`,
  notFound: () => "/not-found",
  testPaddle: () => "/test-paddle",
  userFeed: (
    feedId: string,
    opts?: { tab?: UserFeedTabSearchParam; new?: boolean; scope?: RouteScope },
  ) => {
    let str = `${scopePrefix(opts?.scope)}/feeds/${feedId}${opts?.tab ? opts.tab : ""}`;

    if (opts?.tab && opts.new) {
      str += "&new=true";
    } else if (opts?.new) {
      str += "?new=true";
    }

    return str;
  },
  userFeedConnection: (
    data: {
      feedId: string;
      connectionType: FeedConnectionType;
      connectionId: string;
      scope?: RouteScope;
    },
    opts?: { tab?: UserFeedConnectionTabSearchParam },
  ) =>
    `${scopePrefix(data.scope)}/feeds/${data.feedId}${getConnectionPathByType(
      data.connectionType,
    )}/${data.connectionId}${opts?.tab ? opts.tab : ""}`,
  loginReddit: () => "/api/v1/reddit/login",
};

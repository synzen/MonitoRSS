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
 * Workspace scope uses a human-readable slug.
 * Personal-scope routes (no `workspaceSlug`) stay unprefixed so existing bookmarks survive.
 */
export type RouteScope = { workspaceSlug?: string };

const scopePrefix = (scope?: RouteScope) =>
  scope?.workspaceSlug ? `/workspaces/${scope.workspaceSlug}` : "";

export const pages = {
  checkout: (priceId: string, feeds?: { quantity: number; priceId: string }) =>
    `/paddle-checkout/${priceId}?${feeds ? `feeds=${feeds.quantity},${feeds.priceId}` : ""}`,
  messageBuilder: (data: {
    feedId: string;
    connectionType: FeedConnectionType;
    connectionId: string;
    scope?: RouteScope;
  }) => `${pages.userFeedConnection(data)}/message-builder`,
  addFeeds: (scope?: RouteScope) => `${scopePrefix(scope)}/add-feeds`,
  userSettings: () => "/settings",
  workspaceSettings: (workspaceSlug: string) => `/workspaces/${workspaceSlug}/settings`,
  workspaceBilling: (workspaceSlug: string) => `/workspaces/${workspaceSlug}/settings/billing`,
  workspaceInvite: (inviteId: string) => `/invites/${inviteId}`,
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

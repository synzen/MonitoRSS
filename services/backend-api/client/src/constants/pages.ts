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

export const pages = {
  checkout: (priceId: string, feeds?: { quantity: number; priceId: string }) =>
    `/paddle-checkout/${priceId}?${feeds ? `feeds=${feeds.quantity},${feeds.priceId}` : ""}`,
  addFeeds: () => "/add-feeds",
  userSettings: () => "/settings",
  userFeeds: () => "/feeds",
  notFound: () => "/not-found",
  testPaddle: () => "/test-paddle",
  userFeed: (feedId: string, opts?: { tab?: UserFeedTabSearchParam; new?: boolean }) => {
    let str = `/feeds/${feedId}${opts?.tab ? opts.tab : ""}`;

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
    },
    opts?: { tab?: UserFeedConnectionTabSearchParam }
  ) =>
    `/feeds/${data.feedId}${getConnectionPathByType(data.connectionType)}/${data.connectionId}${
      opts?.tab ? opts.tab : ""
    }`,
  userFeedsFaq: () => "/feeds/faq",
  loginReddit: () => "/api/v1/reddit/login",
};

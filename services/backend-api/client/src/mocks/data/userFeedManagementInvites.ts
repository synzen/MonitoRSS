import { UserFeedManagementInvite } from "../../features/feed/types";
import mockUserFeeds from "./userFeeds";

const mockUserFeedManagementInvites: UserFeedManagementInvite[] = [
  {
    id: "1",
    feed: {
      id: mockUserFeeds[0].id,
      title: mockUserFeeds[0].title,
      url: mockUserFeeds[0].url,
      ownerDiscordUserId: "1",
    },
  },
  {
    id: "2",
    feed: {
      id: mockUserFeeds[1].id,
      title: mockUserFeeds[1].title,
      url: mockUserFeeds[1].url,
      ownerDiscordUserId: "2",
    },
  },
];

export default mockUserFeedManagementInvites;

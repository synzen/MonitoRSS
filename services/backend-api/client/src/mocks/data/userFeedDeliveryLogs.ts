import { UserFeedDeliveryLog, UserFeedDeliveryLogStatus } from "../../features/feed";
import { mockFeedChannelConnections } from "./feedConnection";

export const mockUserFeedDeliveryLogs: UserFeedDeliveryLog[] = [
  {
    id: "1",
    status: UserFeedDeliveryLogStatus.DELIVERED,
    createdAt: new Date().toISOString(),
    details: {},
    articleIdHash: "123",
    mediumId: mockFeedChannelConnections[0].id,
  },
  {
    id: "2",
    status: UserFeedDeliveryLogStatus.PENDING_DELIVERY,
    createdAt: new Date().toISOString(),
    details: {},
    articleIdHash: "456",
    mediumId: mockFeedChannelConnections[0].id,
  },
  {
    id: "3",
    status: UserFeedDeliveryLogStatus.ARTICLE_RATE_LIMITED,
    createdAt: new Date().toISOString(),
    details: {},
    articleIdHash: "789",
    mediumId: mockFeedChannelConnections[0].id,
  },
  {
    id: "4",
    status: UserFeedDeliveryLogStatus.FAILED,
    createdAt: new Date().toISOString(),
    details: {
      message: "Some internal error message here",
      data: {},
    },
    articleIdHash: "987",
    mediumId: mockFeedChannelConnections[0].id,
  },
  {
    id: "5",
    status: UserFeedDeliveryLogStatus.MEDIUM_RATE_LIMITED,
    createdAt: new Date().toISOString(),
    details: {},
    articleIdHash: "654",
    mediumId: mockFeedChannelConnections[0].id,
  },
  {
    id: "6",
    status: UserFeedDeliveryLogStatus.REJECTED,
    createdAt: new Date().toISOString(),
    details: {},
    articleIdHash: "654",
    mediumId: mockFeedChannelConnections[0].id,
  },
  {
    id: "7",
    status: UserFeedDeliveryLogStatus.PARTIALLY_DELIVERED,
    createdAt: new Date().toISOString(),
    details: {},
    articleIdHash: "654",
    mediumId: mockFeedChannelConnections[0].id,
  },
];

import { UserFeedRequest, UserFeedRequestStatus } from "../../features/feed";

export const mockUserFeedRequests: UserFeedRequest[] = [
  {
    id: "1",
    status: UserFeedRequestStatus.OK,
    createdAt: Math.floor(new Date(2020).getTime() / 1000),
    createdAtIso: new Date(2020).toISOString(),
    finishedAtIso: new Date(2020).toISOString(),
    freshnessLifetimeMs: 0,
    url: "https://example.com",
    headers: {},
    response: {
      headers: {},
      statusCode: 200,
    },
  },
  {
    id: "2",
    status: UserFeedRequestStatus.INTERNAL_ERROR,
    createdAt: Math.floor(new Date(2021).getTime() / 1000),
    createdAtIso: new Date(2020).toISOString(),
    finishedAtIso: new Date(2020).toISOString(),
    freshnessLifetimeMs: 0,
    url: "https://example.com",
    headers: {},
    response: {
      headers: {},
      statusCode: 200,
    },
  },
  {
    id: "3",
    status: UserFeedRequestStatus.FETCH_ERROR,
    createdAt: Math.floor(new Date(2022).getTime() / 1000),
    createdAtIso: new Date(2020).toISOString(),
    finishedAtIso: new Date(2020).toISOString(),
    freshnessLifetimeMs: 0,
    url: "https://example.com",
    headers: {},
    response: {
      headers: {},
      statusCode: 200,
    },
  },
  {
    id: "4",
    status: UserFeedRequestStatus.PARSE_ERROR,
    createdAt: Math.floor(new Date(2023).getTime() / 1000),
    createdAtIso: new Date(2020).toISOString(),
    finishedAtIso: new Date(2020).toISOString(),
    freshnessLifetimeMs: 0,
    url: "https://example.com",
    headers: {},
    response: {
      headers: {},
      statusCode: 200,
    },
  },
  {
    id: "4",
    status: UserFeedRequestStatus.BAD_STATUS_CODE,
    createdAt: Math.floor(new Date(2023).getTime() / 1000),
    createdAtIso: new Date(2020).toISOString(),
    finishedAtIso: new Date(2020).toISOString(),
    freshnessLifetimeMs: 0,
    url: "https://example.com",
    headers: {},
    response: {
      headers: {},
      statusCode: 403,
    },
  },
];

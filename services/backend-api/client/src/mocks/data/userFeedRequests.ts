import { UserFeedRequest, UserFeedRequestStatus } from '../../features/feed';

export const mockUserFeedRequests: UserFeedRequest[] = [{
  id: 1,
  status: UserFeedRequestStatus.OK,
  createdAt: Math.floor(new Date(2020).getTime() / 1000),
}, {
  id: 2,
  status: UserFeedRequestStatus.FAILED,
  createdAt: Math.floor(new Date(2021).getTime() / 1000),
}, {
  id: 3,
  status: UserFeedRequestStatus.FETCH_ERROR,
  createdAt: Math.floor(new Date(2022).getTime() / 1000),
}, {
  id: 4,
  status: UserFeedRequestStatus.PARSE_ERROR,
  createdAt: Math.floor(new Date(2023).getTime() / 1000),
}];

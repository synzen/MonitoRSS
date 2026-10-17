import {
  FeedTooManyRequestsException,
  FeedUnauthorizedException,
  FeedForbiddenException,
  FeedNotFoundException,
  FeedInternalErrorException,
  FeedRequestException,
} from "../../shared/exceptions/user-feeds.exceptions";

export class FeedFetcherService {
  handleStatusCode(code: number): void {
    if (code === 200) return;
    if (code === 429) throw new FeedTooManyRequestsException();
    if (code === 401) throw new FeedUnauthorizedException();
    if (code === 403) throw new FeedForbiddenException();
    if (code === 404) throw new FeedNotFoundException();
    if (code >= 500) throw new FeedInternalErrorException();
    throw new FeedRequestException(`Non-200 status code (${code})`);
  }
}

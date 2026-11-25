import { StandardException } from "./standard.exception";

export class FeedLimitReachedException extends StandardException {}
// Adding a feed to a dormant workspace (billing enabled, no benefit-granting
// subscription). Distinct from FeedLimitReachedException so the client can
// show the workspace activation prompt instead of a generic limit error.
export class WorkspaceNotSubscribedException extends StandardException {}
export class BannedFeedException extends StandardException {}
export class SourceFeedNotFoundException extends StandardException {}
export class RefreshRateNotAllowedException extends StandardException {}
// Premium feeds (platform URLs served by provider adapters). Not-supported:
// the account is not in the closed beta. Plan-required: in the beta but the
// scope has no paid plan behind it.
export class PremiumFeedsNotSupportedException extends StandardException {}
export class PremiumFeedsPlanRequiredException extends StandardException {}
export class PremiumFeedsLimitReachedException extends StandardException {}
// Reddit fetches through the feed owner's own OAuth grant (the official API
// meters per user and serves nothing anonymously); without one a reddit feed
// would never fetch.
export class RedditConnectionRequiredException extends StandardException {}
export class ManualRequestTooSoonException extends StandardException {
  secondsUntilNextRequest?: number;

  constructor(
    message?: string,
    options?: { secondsUntilNextRequest?: number },
  ) {
    super(message);
    this.secondsUntilNextRequest = options?.secondsUntilNextRequest;
  }
}
export class FeedFetchTimeoutException extends StandardException {}
export class FeedTooLargeException extends StandardException {}
export class NoFeedOnHtmlPageException extends StandardException {}
export class FeedParseException extends StandardException {}
export class FeedRequestException extends StandardException {}
export class FeedInvalidSslCertException extends StandardException {}
export class FeedTooManyRequestsException extends StandardException {}
export class FeedUnauthorizedException extends StandardException {}
export class FeedForbiddenException extends StandardException {}
export class FeedNotFoundException extends StandardException {}
export class FeedInternalErrorException extends StandardException {}

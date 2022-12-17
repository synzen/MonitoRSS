import {
  ArticleDeliveryErrorCode,
  ArticleDeliveryRejectedCode,
} from "../constants";

export enum ArticleDeliveryStatus {
  // The article is being delivered
  PendingDelivery = "pending-delivery",
  Sent = "sent",
  // An error happened within this service
  Failed = "failed",
  // Discord returns a 400 for example. Requires user action.
  Rejected = "rejected",
  // Filters blocked the article fromg getting delivered
  FilteredOut = "filtered-out",
  // Rate limit enforced by this service
  RateLimited = "rate-limited",
}

interface ArticleDeliveryPendingDeliveryState {
  id: string;
  mediumId: string;
  status: ArticleDeliveryStatus.PendingDelivery;
}

interface ArticleDeliverySentState {
  id: string;
  mediumId: string;
  status: ArticleDeliveryStatus.Sent;
}

interface ArticleDeliveryRateLimitState {
  id: string;
  mediumId: string;
  status: ArticleDeliveryStatus.RateLimited;
}

interface ArticleDeliveryRejectedState {
  id: string;
  mediumId: string;
  status: ArticleDeliveryStatus.Rejected;
  errorCode: ArticleDeliveryRejectedCode;
  internalMessage: string;
}

interface ArticleDeliveryFailureState {
  id: string;
  mediumId: string;
  status: ArticleDeliveryStatus.Failed;
  /**
   * User-facing error code.
   */
  errorCode: ArticleDeliveryErrorCode;
  /**
   * Used for internal troubleshooting.
   */
  internalMessage: string;
}

interface ArticleDeliveryFilteredOutState {
  id: string;
  mediumId: string;
  status: ArticleDeliveryStatus.FilteredOut;
}

export type ArticleDeliveryState =
  | ArticleDeliveryPendingDeliveryState
  | ArticleDeliverySentState
  | ArticleDeliveryFailureState
  | ArticleDeliveryFilteredOutState
  | ArticleDeliveryRejectedState
  | ArticleDeliveryRateLimitState;

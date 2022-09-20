import {
  ArticleDeliveryErrorCode,
  ArticleDeliveryRejectedCode,
} from "../constants";

export enum ArticleDeliveryStatus {
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

interface ArticleDeliverySentState {
  status: ArticleDeliveryStatus.Sent;
}

interface ArticleDeliveryRateLimitState {
  status: ArticleDeliveryStatus.RateLimited;
}

interface ArticleDeliveryRejectedState {
  status: ArticleDeliveryStatus.Rejected;
  errorCode: ArticleDeliveryRejectedCode;
  internalMessage: string;
}

interface ArticleDeliveryFailureState {
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
  status: ArticleDeliveryStatus.FilteredOut;
}

export type ArticleDeliveryState =
  | ArticleDeliverySentState
  | ArticleDeliveryFailureState
  | ArticleDeliveryFilteredOutState
  | ArticleDeliveryRejectedState
  | ArticleDeliveryRateLimitState;

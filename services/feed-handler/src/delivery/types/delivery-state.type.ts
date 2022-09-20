import {
  ArticleDeliveryErrorCode,
  ArticleDeliveryRejectedCode,
} from "../delivery.constants";

export enum ArticleDeliveryStatus {
  Sent = "Sent",
  // An error happened within this service
  Failed = "failed",
  // Discord returns a 400 for example
  Rejected = "rejected",
  // Filters blocked the article fromg getting delivered
  FilteredOut = "filtered-out",
}

interface ArticleDeliverySentState {
  status: ArticleDeliveryStatus.Sent;
}

interface ArticleDeliveryRejectedState {
  status: ArticleDeliveryStatus.Rejected;
  errorCode: ArticleDeliveryRejectedCode;
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
  | ArticleDeliveryRejectedState;

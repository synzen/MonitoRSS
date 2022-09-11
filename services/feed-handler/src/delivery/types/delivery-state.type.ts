import { ArticleDeliveryErrorCode } from "../delivery.constants";

export enum ArticleDeliveryStatus {
  Sent = "Sent",
  Failed = "failed",
  FilteredOut = "filtered-out",
}

interface ArticleDeliverySentState {
  status: ArticleDeliveryStatus.Sent;
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
  | ArticleDeliveryFilteredOutState;

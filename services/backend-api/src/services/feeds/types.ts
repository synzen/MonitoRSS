import type { IFeed } from "../../repositories/interfaces/feed.types";
import type { IFailRecord } from "../../repositories/interfaces/fail-record.types";

export enum FeedStatus {
  OK = "ok",
  FAILED = "failed",
  FAILING = "failing",
  DISABLED = "disabled",
  CONVERTED_TO_USER = "converted-to-user",
}

export interface DetailedFeed extends IFeed {
  status: FeedStatus;
  failReason?: string;
  disabledReason?: string;
  refreshRateSeconds: number;
}

export interface FeedWithFailRecord extends IFeed {
  failRecord?: IFailRecord;
}

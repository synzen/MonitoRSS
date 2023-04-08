import { UserFeedDisabledCode } from "../../user-feeds/types";
import { FeedRejectCode } from "../constants";

export const getUserFeedDisableCodeByFeedRejectCode = (
  code: FeedRejectCode
): UserFeedDisabledCode => {
  switch (code) {
    case FeedRejectCode.InvalidFeed:
      return UserFeedDisabledCode.InvalidFeed;
    default:
      throw new Error(
        `Failed to get user feed disable code by feed reject code since it is` +
          ` unhandled: ${code}`
      );
  }
};

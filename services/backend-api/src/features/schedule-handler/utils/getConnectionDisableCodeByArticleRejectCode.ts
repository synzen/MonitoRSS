import { UserFeedDisabledCode } from "../../user-feeds/types";
import { ArticleRejectCode } from "../constants";

export const getConnectionDisableCodeByArticleRejectCode = (
  articleRejectCode: ArticleRejectCode
): UserFeedDisabledCode => {
  switch (articleRejectCode) {
    case ArticleRejectCode.BadRequest:
      return UserFeedDisabledCode.BadFormat;
    case ArticleRejectCode.Forbidden:
      return UserFeedDisabledCode.MissingPermissions;
    default:
      throw new Error(
        `Failed to get connection disable code by article reject code since it is` +
          ` unhandled: ${articleRejectCode}`
      );
  }
};

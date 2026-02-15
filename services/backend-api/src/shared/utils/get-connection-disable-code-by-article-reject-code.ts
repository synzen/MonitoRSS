import { FeedConnectionDisabledCode } from "../../repositories/shared/enums";
import { ArticleRejectCode } from "../enums/article-reject-code";

export function getConnectionDisableCodeByArticleRejectCode(
  articleRejectCode: ArticleRejectCode,
): FeedConnectionDisabledCode {
  switch (articleRejectCode) {
    case ArticleRejectCode.BadRequest:
      return FeedConnectionDisabledCode.BadFormat;
    case ArticleRejectCode.Forbidden:
      return FeedConnectionDisabledCode.MissingPermissions;
    case ArticleRejectCode.MediumNotFound:
      return FeedConnectionDisabledCode.MissingMedium;
    default:
      throw new Error(
        `Failed to get connection disable code by article reject code since it is` +
          ` unhandled: ${articleRejectCode}`,
      );
  }
}

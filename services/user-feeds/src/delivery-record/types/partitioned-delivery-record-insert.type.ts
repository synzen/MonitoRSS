import {
  ArticleDeliveryContentType,
  ArticleDeliveryStatus,
} from "../../shared";

export default interface PartitionedDeliveryRecordInsert {
  id: string;
  feedId: string;
  mediumId: string;
  createdAt: Date;
  status: ArticleDeliveryStatus;
  contentType: ArticleDeliveryContentType | null;
  parentId: string | null;
  internalMessage: string | null;
  errorCode: string | null;
  externalDetail: string | null;
  articleId: string | null;
  articleIdHash: string | null;
  articleData: Record<string, string> | null;
}

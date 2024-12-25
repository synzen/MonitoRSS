import { FilterExpressionReference } from "../../article-filters/types";
import { FormatOptions } from "../../article-formatter/types";
import { Article, FeedV2Event, MediumPayload } from "../../shared";
import { ArticleDeliveryState } from "../types";

export interface DeliverArticleDetails {
  mediumId: string;
  feedDetails: FeedV2Event["data"]["feed"];
  deliverySettings: MediumPayload["details"];
  filterReferences: FilterExpressionReference;
}

export interface DeliveryMedium {
  deliverArticle(
    article: Article,
    details: DeliverArticleDetails
  ): Promise<ArticleDeliveryState[]>;
  formatArticle(article: Article, options: FormatOptions): Promise<Article>;
}

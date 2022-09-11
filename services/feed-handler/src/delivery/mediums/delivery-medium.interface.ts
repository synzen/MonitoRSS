import { Article, FeedV2Event, MediumPayload } from "../../shared";
import { ArticleDeliveryState } from "../types";

export interface DeliveryMedium {
  deliverArticle(
    article: Article,
    details: {
      feedDetails: FeedV2Event["feed"];
      deliverySettings: MediumPayload["details"];
    }
  ): Promise<ArticleDeliveryState>;
}

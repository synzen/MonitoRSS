import { Article, FeedV2Event, MediumPayload } from "../../shared";

export interface DeliveryMedium {
  deliverArticle(
    article: Article,
    details: {
      feedDetails: FeedV2Event["feed"];
      deliverySettings: MediumPayload["details"];
    }
  ): Promise<void>;
}

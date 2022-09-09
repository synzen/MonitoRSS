import { Article, FeedV2Event, MediumPayload } from "../../shared";

export interface DeliveryMedium {
  deliver(details: {
    articles: Article[];
    feedDetails: FeedV2Event["feed"];
    deliverySettings: MediumPayload["details"];
  }): Promise<void>;
}

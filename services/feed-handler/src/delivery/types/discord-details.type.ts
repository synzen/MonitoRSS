import { Article, DiscordMediumPayload } from "../../shared";

export interface DeliveryDetails {
  articles: Article[];
  feedDetails: {
    id: string;
    url: string;
    passingComparisons: string[];
    blockingComparisons: string[];
  };
  deliverySettings: DiscordMediumPayload["details"];
}

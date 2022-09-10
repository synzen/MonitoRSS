import { Article, DiscordMediumPayloadDetails } from "../../shared";

export interface DeliveryDetails {
  articles: Article[];
  feedDetails: {
    id: string;
    url: string;
    passingComparisons: string[];
    blockingComparisons: string[];
  };
  deliverySettings: DiscordMediumPayloadDetails;
}

import { DiscordMediumPayloadDetails } from "../../shared";

export interface DeliveryDetails {
  feedDetails: {
    id: string;
    url: string;
    passingComparisons: string[];
    blockingComparisons: string[];
  };
  deliverySettings: DiscordMediumPayloadDetails;
}

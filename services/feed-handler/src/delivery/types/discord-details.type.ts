import { DiscordMediumPayloadDetails } from "../../shared";

export interface DeliveryDetails {
  deliveryId: string;
  mediumId: string;
  feedDetails: {
    id: string;
    url: string;
    passingComparisons: string[];
    blockingComparisons: string[];
  };
  deliverySettings: DiscordMediumPayloadDetails;
}

import { DiscordMediumPayloadDetails } from "../../shared";

export interface DeliveryDetails {
  mediumId: string;
  feedDetails: {
    id: string;
    url: string;
    passingComparisons: string[];
    blockingComparisons: string[];
  };
  deliverySettings: DiscordMediumPayloadDetails;
}

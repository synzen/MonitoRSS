import { DiscordMediumPayloadDetails } from "../../shared";

export interface TestDiscordDeliveryDetails {
  mediumDetails: Omit<DiscordMediumPayloadDetails, "guildId">;
}

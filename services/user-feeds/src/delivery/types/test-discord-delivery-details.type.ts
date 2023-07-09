import { FilterExpressionReference } from "../../article-filters/types";
import { DiscordMediumPayloadDetails } from "../../shared";

export interface TestDiscordDeliveryDetails {
  mediumDetails: Omit<DiscordMediumPayloadDetails, "guildId">;
  filterReferences: FilterExpressionReference;
}

import { DiscordChannelConnection } from "../../features/feeds/entities/feed-connections";
import { DiscordMediumEvent } from "../types";

export const castDiscordComponentRowsForMedium = (
  rows?: DiscordChannelConnection["details"]["componentRows"] | null
): DiscordMediumEvent["details"]["components"] => {
  if (!rows) {
    return [];
  }

  return rows.map((r) => ({
    type: 1,
    components:
      r.components?.map(({ label, type, style, url }) => {
        return {
          type,
          label,
          style,
          url,
        };
      }) || [],
  }));
};

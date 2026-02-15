import type { IDiscordComponentRow } from "../../repositories/interfaces/feed-connection.types";

export const castDiscordComponentRowsForMedium = (
  rows?: IDiscordComponentRow[] | null,
) => {
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

import type { DiscordChannelType } from "../../shared/types/discord.types";

export interface ProfileSettings {
  dateFormat: string;
  dateLanguage: string;
  timezone: string;
}

export interface DiscordGuildChannelFormatted {
  id: string;
  name: string;
  guild_id: string;
  type: DiscordChannelType;
  category: null | { id: string; name: string };
  availableTags?: Array<{
    id: string;
    name: string;
    emojiId: string | null;
    emojiName: string | null;
    hasPermissionToUse: boolean;
  }>;
}

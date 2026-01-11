import { DiscordChannelType } from "../../../common";
import { DiscordGuildChannelFormatted } from "../types";

interface ServerChannelOutputDto {
  id: string;
  name: string;
  category: null | {
    id: string;
    name: string;
  };
  availableTags?: Array<{
    id: string;
    name: string;
    emojiId: string | null;
    emojiName: string | null;
    hasPermissionToUse: boolean;
  }>;
}

const mappedTypes: Partial<Record<DiscordChannelType, string>> = {
  [DiscordChannelType.GUILD_TEXT]: "text",
  [DiscordChannelType.GUILD_VOICE]: "voice",
  [DiscordChannelType.GUILD_CATEGORY]: "category",
  [DiscordChannelType.GUILD_ANNOUNCEMENT]: "announcement",
  [DiscordChannelType.GUILD_FORUM]: "forum",
};

export class GetServerChannelsOutputDto {
  results: ServerChannelOutputDto[];
  total: number;

  static fromEntities(
    channels: DiscordGuildChannelFormatted[]
  ): GetServerChannelsOutputDto {
    return {
      results: channels.map((channel) => ({
        id: channel.id,
        name: channel.name,
        category: channel.category,
        type: mappedTypes[channel.type],
        availableTags: channel.availableTags,
      })),
      total: channels.length,
    };
  }
}

import { DiscordChannelType } from "../../../common";
import { DiscordGuildChannelFormatted } from "../types";

interface ServerChannelOutputDto {
  id: string;
  name: string;
  category: null | {
    id: string;
    name: string;
  };
}

const mappedTypes: Record<DiscordChannelType, string> = {
  [DiscordChannelType.GUILD_TEXT]: "text",
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
      })),
      total: channels.length,
    };
  }
}

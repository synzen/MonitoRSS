import { DiscordGuildChannelFormatted } from "../types";

interface ServerChannelOutputDto {
  id: string;
  name: string;
  category: null | {
    id: string;
    name: string;
  };
}

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
      })),
      total: channels.length,
    };
  }
}

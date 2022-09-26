import { DiscordGuildChannel } from "../../../common";

interface ServerChannelOutputDto {
  id: string;
  name: string;
}

export class GetServerChannelsOutputDto {
  results: ServerChannelOutputDto[];
  total: number;

  static fromEntities(
    channels: DiscordGuildChannel[]
  ): GetServerChannelsOutputDto {
    return {
      results: channels.map((channel) => ({
        id: channel.id,
        name: channel.name,
      })),
      total: channels.length,
    };
  }
}

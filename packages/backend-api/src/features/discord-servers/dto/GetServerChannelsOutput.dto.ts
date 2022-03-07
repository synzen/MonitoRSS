import { DiscordServerChannel } from '../types/DiscordServerChannel.type';

interface ServerChannelOutputDto {
  id: string;
  name: string;
}

export class GetServerChannelsOutputDto {
  results: ServerChannelOutputDto[];
  total: number;

  static fromEntities(
    channels: DiscordServerChannel[],
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

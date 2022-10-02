import {
  array, InferType, number, object,
} from 'yup';
import fetchRest from '../../../utils/fetchRest';
import { DiscordServerChannelSchema } from '../types/DiscordServerChannel';

export interface GetServerChannelsInput {
  serverId: string
}

const GetServersChannelsOutputSchema = object({
  results: array(DiscordServerChannelSchema).required(),
  total: number().required(),
});

export type GetServerChannelsOutput = InferType<typeof GetServersChannelsOutputSchema>;

export const getServerChannels = async (
  options: GetServerChannelsInput,
): Promise<GetServerChannelsOutput> => {
  const res = await fetchRest(
    `/api/v1/discord-servers/${options.serverId}/channels`,
    {
      validateSchema: GetServersChannelsOutputSchema,
    },
  );

  return res as GetServerChannelsOutput;
};

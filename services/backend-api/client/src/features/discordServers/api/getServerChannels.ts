import { array, InferType, number, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { DiscordServerChannelSchema } from "../types/DiscordServerChannel";
import { GetDiscordChannelType } from "../constants";

export interface GetServerChannelsInput {
  serverId: string;
  include?: GetDiscordChannelType[];
  types?: GetDiscordChannelType[];
}

const GetServersChannelsOutputSchema = object({
  results: array(DiscordServerChannelSchema).required(),
  total: number().required(),
});

export type GetServerChannelsOutput = InferType<typeof GetServersChannelsOutputSchema>;

export const getServerChannels = async (
  options: GetServerChannelsInput
): Promise<GetServerChannelsOutput> => {
  const searchParams = new URLSearchParams({
    include: options.include?.join(",") || "",
    types: options.types?.join(",") || "",
  });

  const res = await fetchRest(
    `/api/v1/discord-servers/${options.serverId}/channels?${searchParams}`,
    {
      validateSchema: GetServersChannelsOutputSchema,
    }
  );

  return res as GetServerChannelsOutput;
};

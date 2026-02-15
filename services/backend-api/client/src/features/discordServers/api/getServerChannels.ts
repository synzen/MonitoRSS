import { array, InferType, number, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { DiscordServerChannelSchema } from "../types/DiscordServerChannel";
import { GetDiscordChannelType } from "../constants";

export interface GetServerChannelsInput {
  serverId: string;
  types?: GetDiscordChannelType[];
}

const GetServersChannelsOutputSchema = object({
  results: array(DiscordServerChannelSchema).required(),
  total: number().required(),
});

export type GetServerChannelsOutput = InferType<typeof GetServersChannelsOutputSchema>;

export const getServerChannels = async (
  options: GetServerChannelsInput,
): Promise<GetServerChannelsOutput> => {
  const searchParams = new URLSearchParams();

  if (options.types?.length) {
    searchParams.set("types", options.types.join(","));
  }

  const queryString = searchParams.toString();
  const url = `/api/v1/discord-servers/${options.serverId}/channels${queryString ? `?${queryString}` : ""}`;

  const res = await fetchRest(url, {
    validateSchema: GetServersChannelsOutputSchema,
  });

  return res as GetServerChannelsOutput;
};

import { array, InferType, number, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { DiscordServerChannelSchema } from "../types/DiscordServerChannel";

export interface GetServerActiveThreadsInput {
  serverId: string;
  options?: {
    parentChannelId?: string;
  };
}

const GetServerActiveThreadsOutputSchema = object({
  results: array(DiscordServerChannelSchema).required(),
  total: number().required(),
});

export type GetServerActiveThreadsOutput = InferType<typeof GetServerActiveThreadsOutputSchema>;

export const getServerActiveThreads = async (
  options: GetServerActiveThreadsInput,
): Promise<GetServerActiveThreadsOutput> => {
  const searchParams = new URLSearchParams();

  if (options.options?.parentChannelId) {
    searchParams.append("parentChannelId", options.options.parentChannelId);
  }

  const res = await fetchRest(
    `/api/v1/discord-servers/${options.serverId}/active-threads?${searchParams.toString()}`,
    {
      validateSchema: GetServerActiveThreadsOutputSchema,
    },
  );

  return res as GetServerActiveThreadsOutput;
};

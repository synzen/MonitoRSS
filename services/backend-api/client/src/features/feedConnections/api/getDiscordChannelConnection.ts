import { object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { FeedConnectionSchema, FeedDiscordChannelConnection } from "@/types";

export interface GetDiscordChannelConnectionInput {
  feedId: string;
  connectionId: string;
}

const GetFeedConnectionOutputSchema = object({
  result: FeedConnectionSchema,
}).required();

export type GetDiscordChannelConnectionOutput = {
  result: FeedDiscordChannelConnection;
};

export const getDiscordChannelConnection = async (
  options: GetDiscordChannelConnectionInput,
): Promise<GetDiscordChannelConnectionOutput> => {
  const res = await fetchRest(
    `/api/v1/user-feeds/${options.feedId}/connections/discord-channels/${options.connectionId}`,
    {
      validateSchema: GetFeedConnectionOutputSchema,
    },
  );

  return res as GetDiscordChannelConnectionOutput;
};

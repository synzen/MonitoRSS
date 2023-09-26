import { InferType, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { FeedConnectionSchema } from "@/types";

export interface CreateDiscordChannelConnectionInput {
  feedId: string;
  details: {
    name: string;
    channelId?: string;
    webhook?: {
      id: string;
      name?: string | null;
      iconUrl?: string | null;
    };
  };
}

const CreateFeedConnectionOutputSchema = object({
  result: FeedConnectionSchema,
}).required();

export type CreateDiscordChannelConnectionOutput = InferType<
  typeof CreateFeedConnectionOutputSchema
>;

export const createDiscordChannelConnection = async (
  options: CreateDiscordChannelConnectionInput
): Promise<CreateDiscordChannelConnectionOutput> => {
  const res = await fetchRest(`/api/v1/user-feeds/${options.feedId}/connections/discord-channels`, {
    validateSchema: CreateFeedConnectionOutputSchema,
    requestOptions: {
      method: "POST",
      body: JSON.stringify(options.details),
    },
  });

  return res as CreateDiscordChannelConnectionOutput;
};

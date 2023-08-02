import { InferType, object, string } from "yup";
import fetchRest from "../../../utils/fetchRest";

export interface CreateDiscordChannelConnectionCloneInput {
  feedId: string;
  connectionId: string;
  details: {
    name: string;
  };
}

const CreateDiscordChannelConnectionCloneOutputSchema = object({
  result: object({
    id: string().required(),
  }).required(),
}).required();

export type CreateDiscordChannelConnectionCloneOutput = InferType<
  typeof CreateDiscordChannelConnectionCloneOutputSchema
>;

export const createDiscordChannelConnectionClone = async (
  options: CreateDiscordChannelConnectionCloneInput
): Promise<CreateDiscordChannelConnectionCloneOutput> => {
  const res = await fetchRest(
    `/api/v1/user-feeds/${options.feedId}/connections/discord-channels/${options.connectionId}/clone`,
    {
      validateSchema: CreateDiscordChannelConnectionCloneOutputSchema,
      requestOptions: {
        method: "POST",
        body: JSON.stringify(options.details),
      },
    }
  );

  return res as CreateDiscordChannelConnectionCloneOutput;
};

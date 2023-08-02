import { InferType, object, string } from "yup";
import fetchRest from "../../../utils/fetchRest";

export interface CreateDiscordWebhookConnectionCloneInput {
  feedId: string;
  connectionId: string;
  details: {
    name: string;
  };
}

const CreateDiscordWebhookConnectionCloneOutputSchema = object({
  result: object({
    id: string().required(),
  }).required(),
}).required();

export type CreateDiscordWebhookConnectionCloneOutput = InferType<
  typeof CreateDiscordWebhookConnectionCloneOutputSchema
>;

export const createDiscordWebhookConnectionClone = async (
  options: CreateDiscordWebhookConnectionCloneInput
): Promise<CreateDiscordWebhookConnectionCloneOutput> => {
  const res = await fetchRest(
    `/api/v1/user-feeds/${options.feedId}/connections/discord-webhooks/${options.connectionId}/clone`,
    {
      validateSchema: CreateDiscordWebhookConnectionCloneOutputSchema,
      requestOptions: {
        method: "POST",
        body: JSON.stringify(options.details),
      },
    }
  );

  return res as CreateDiscordWebhookConnectionCloneOutput;
};

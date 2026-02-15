import { InferType, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { SendTestArticleResultSchema } from "@/types";
import { CreateDiscordChannelConnectionPreviewInput } from "./createDiscordChannelConnectionPreview";

export interface CreateDiscordChannelConnectionTestArticleInput extends CreateDiscordChannelConnectionPreviewInput {}

const CreateDiscordChannelConnectionTestArticleOutputSchema = object({
  result: SendTestArticleResultSchema,
}).required();

export type CreateDiscordChannelConnectionTestArticleOutput = InferType<
  typeof CreateDiscordChannelConnectionTestArticleOutputSchema
>;

export const createDiscordChannelConnectionTestArticle = async (
  options: CreateDiscordChannelConnectionTestArticleInput,
): Promise<CreateDiscordChannelConnectionTestArticleOutput> => {
  const res = await fetchRest(
    `/api/v1/user-feeds/${options.feedId}/connections/` +
      `discord-channels/${options.connectionId}/test`,
    {
      validateSchema: CreateDiscordChannelConnectionTestArticleOutputSchema,
      requestOptions: {
        method: "POST",
        body: JSON.stringify(options.data),
      },
    },
  );

  return res as CreateDiscordChannelConnectionTestArticleOutput;
};

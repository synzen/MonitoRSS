import { InferType, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { SendTestArticleResultSchema } from "@/types";

export interface CreateDiscordWebhookConnectionTestArticleInput {
  feedId: string;
  connectionId: string;
  articleId?: string;
}

const CreateDiscordWebhookConnectionTestArticleOutputSchema = object({
  result: SendTestArticleResultSchema,
}).required();

export type CreateDiscordWebhookConnectionTestArticleOutput = InferType<
  typeof CreateDiscordWebhookConnectionTestArticleOutputSchema
>;

export const createDiscordWebhookConnectionTestArticle = async (
  options: CreateDiscordWebhookConnectionTestArticleInput
): Promise<CreateDiscordWebhookConnectionTestArticleOutput> => {
  const res = await fetchRest(
    `/api/v1/user-feeds/${options.feedId}/connections/` +
      `discord-webhooks/${options.connectionId}/test`,
    {
      validateSchema: CreateDiscordWebhookConnectionTestArticleOutputSchema,
      requestOptions: {
        method: "POST",
        body: JSON.stringify({
          article: options.articleId
            ? {
                id: options.articleId,
              }
            : undefined,
        }),
      },
    }
  );

  return res as CreateDiscordWebhookConnectionTestArticleOutput;
};

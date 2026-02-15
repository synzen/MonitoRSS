import { InferType, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { SendTestArticleResultSchema, PreviewEmbedInput } from "@/types";

export interface SendTestArticleDirectInput {
  feedId: string;
  data: {
    article: {
      id: string;
    };
    channelId: string;
    content?: string | null;
    embeds?: PreviewEmbedInput[];
    componentsV2?: Array<Record<string, unknown>> | null;
    placeholderLimits?: Array<{
      placeholder: string;
      characterCount: number;
      appendString?: string | null;
    }> | null;
    webhook?: {
      name: string;
      iconUrl?: string;
    } | null;
    threadId?: string;
    userFeedFormatOptions?: {
      dateFormat?: string | null;
      dateTimezone?: string | null;
      dateLocale?: string | null;
    } | null;
  };
}

const SendTestArticleDirectOutputSchema = object({
  result: SendTestArticleResultSchema,
}).required();

export type SendTestArticleDirectOutput = InferType<typeof SendTestArticleDirectOutputSchema>;

export const sendTestArticleDirect = async (
  options: SendTestArticleDirectInput,
): Promise<SendTestArticleDirectOutput> => {
  const res = await fetchRest(`/api/v1/user-feeds/${options.feedId}/test-send`, {
    validateSchema: SendTestArticleDirectOutputSchema,
    requestOptions: {
      method: "POST",
      body: JSON.stringify(options.data),
    },
  });

  return res as SendTestArticleDirectOutput;
};

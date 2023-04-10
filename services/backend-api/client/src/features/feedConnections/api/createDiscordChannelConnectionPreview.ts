import { InferType, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { CreatePreviewResultSchema, PreviewEmbedInput } from "@/types";

export interface CreateDiscordChannelConnectionPreviewInput {
  feedId: string;
  connectionId: string;
  data: {
    article?: {
      id?: string;
    };
    content?: string | null;
    embeds?: PreviewEmbedInput[];
    splitOptions?: {
      isEnabled?: boolean | null;
      appendChar?: string | null;
      prependChar?: string | null;
      splitChar?: string | null;
    } | null;
    connectionFormatOptions?: {
      formatTables?: boolean | null;
      stripImages?: boolean | null;
    } | null;
    userFeedFormatOptions?: {
      dateFormat?: string | null;
      dateTimezone?: string | null;
    } | null;
  };
}

const CreateDiscordChannelConnectionPreviewOutputSchema = object({
  result: CreatePreviewResultSchema,
}).required();

export type CreateDiscordChannelConnectionPreviewOutput = InferType<
  typeof CreateDiscordChannelConnectionPreviewOutputSchema
>;

export const createDiscordChannelConnectionPreview = async (
  options: CreateDiscordChannelConnectionPreviewInput
): Promise<CreateDiscordChannelConnectionPreviewOutput> => {
  const res = await fetchRest(
    `/api/v1/user-feeds/${options.feedId}/connections/` +
      `discord-channels/${options.connectionId}/preview`,
    {
      validateSchema: CreateDiscordChannelConnectionPreviewOutputSchema,
      requestOptions: {
        method: "POST",
        body: JSON.stringify(options.data),
      },
    }
  );

  return res as CreateDiscordChannelConnectionPreviewOutput;
};

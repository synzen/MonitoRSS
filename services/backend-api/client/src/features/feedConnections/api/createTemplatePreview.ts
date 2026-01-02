import { InferType, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { CreatePreviewResultSchema, PreviewEmbedInput } from "@/types";

export interface CreateTemplatePreviewInput {
  feedId: string;
  data: {
    article: {
      id: string;
    };
    content?: string | null;
    embeds?: PreviewEmbedInput[];
    userFeedFormatOptions?: {
      dateFormat?: string | null;
      dateTimezone?: string | null;
    } | null;
    connectionFormatOptions?: {
      formatTables?: boolean;
      stripImages?: boolean;
      ignoreNewLines?: boolean;
    } | null;
    placeholderLimits?: Array<{
      placeholder: string;
      characterCount: number;
      appendString?: string | null;
    }> | null;
    enablePlaceholderFallback?: boolean;
    componentsV2?: Array<{
      type: string;
      content?: string;
      components?: Array<{
        type: string;
        content?: string;
        style?: number;
        label?: string;
        url?: string | null;
        disabled?: boolean;
      }>;
      accessory?: {
        type: string;
        style?: number;
        label?: string;
        url?: string | null;
        disabled?: boolean;
      } | null;
    }> | null;
  };
}

const CreateTemplatePreviewOutputSchema = object({
  result: CreatePreviewResultSchema,
}).required();

export type CreateTemplatePreviewOutput = InferType<typeof CreateTemplatePreviewOutputSchema>;

export const createTemplatePreview = async (
  options: CreateTemplatePreviewInput
): Promise<CreateTemplatePreviewOutput> => {
  const res = await fetchRest(`/api/v1/user-feeds/${options.feedId}/connections/template-preview`, {
    validateSchema: CreateTemplatePreviewOutputSchema,
    requestOptions: {
      method: "POST",
      body: JSON.stringify(options.data),
    },
  });

  return res as CreateTemplatePreviewOutput;
};

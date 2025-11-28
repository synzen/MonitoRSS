import { InferType, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import {
  CreatePreviewResultSchema,
  CustomPlaceholder,
  ExternalProperty,
  PreviewEmbedInput,
} from "@/types";

export interface CreateDiscordChannelConnectionPreviewInput {
  feedId: string;
  connectionId: string;
  data: {
    article: {
      id: string;
    };
    includeCustomPlaceholderPreviews?: boolean;
    content?: string | null;
    embeds?: PreviewEmbedInput[];
    componentRows?: Array<{
      id: string;
      components: Array<{
        type: number;
        label: string;
        url?: string;
        style: number;
      }>;
    }> | null;
    splitOptions?: {
      isEnabled?: boolean | null;
      appendChar?: string | null;
      prependChar?: string | null;
      splitChar?: string | null;
    } | null;
    connectionFormatOptions?: {
      formatTables?: boolean | null;
      stripImages?: boolean | null;
      disableImageLinkPreviews?: boolean | null;
      ignoreNewLines?: boolean | null;
    } | null;
    userFeedFormatOptions?: {
      dateFormat?: string | null;
      dateTimezone?: string | null;
    } | null;
    mentions?: {
      targets?: Array<{
        type: "role" | "user";
        id: string;
        filters?: {
          expression: Record<string, any>;
        } | null;
      }> | null;
    } | null;
    customPlaceholders?: Array<CustomPlaceholder> | null;
    externalProperties?: Array<ExternalProperty> | null;
    placeholderLimits?: Array<{
      placeholder: string;
      characterCount: number;
      appendString?: string | null;
    }> | null;
    enablePlaceholderFallback?: boolean;
    forumThreadTitle?: string | null;
    forumThreadTags?: Array<{
      id: string;
      filters?: Record<string, any> | null;
    }> | null;
    channelNewThreadExcludesPreview?: boolean | null;
    channelNewThreadTitle?: string | null;
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

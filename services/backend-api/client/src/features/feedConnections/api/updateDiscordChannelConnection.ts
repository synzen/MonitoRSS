import { InferType, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { CustomPlaceholder, FeedConnectionDisabledCode, FeedConnectionSchema } from "@/types";

export interface UpdateDiscordChannelConnectionInput {
  feedId: string;
  connectionId: string;
  details: {
    name?: string;
    channelId?: string;
    componentRows?: Array<{
      id: string;
      components: Array<{
        id: string;
        type: number;
        label: string;
        style: number;
        url?: string | null;
      }>;
    }> | null;
    componentsV2?: Array<{
      type: number;
      content?: string;
      components?: Array<{
        type: number;
        content?: string;
        style?: number;
        label?: string;
        url?: string | null;
        disabled?: boolean;
      }>;
      accessory?: {
        type: number;
        style?: number;
        label?: string;
        url?: string | null;
        disabled?: boolean;
        media?: {
          url: string;
        };
      } | null;
    }> | null;
    webhook?: {
      id: string;
      iconUrl?: string | null;
      name?: string | null;
      threadId?: string | null;
    } | null;
    applicationWebhook?: {
      name: string;
      iconUrl?: string | null;
      channelId: string;
      threadId?: string | null;
    };
    content?: string | null;
    forumThreadTitle?: string | null;
    filters?: {
      expression: Record<string, any>;
    } | null;
    forumThreadTags?: Array<{
      id: string;
      filters?: {
        expression: Record<string, any>;
      } | null;
    }> | null;
    rateLimits?: Array<{
      timeWindowSeconds: number;
      limit: number;
    }> | null;
    placeholderLimits?: Array<{
      placeholder: string;
      characterCount: number;
      appendString?: string | null;
    }> | null;
    threadCreationMethod?: "new-thread" | null;
    channelNewThreadTitle?: string | null;
    channelNewThreadExcludesPreview?: boolean | null;
    disabledCode?: FeedConnectionDisabledCode.Manual | null;
    passingComparisons?: string[];
    blockingComparisons?: string[];
    embeds?: Array<{
      color?: string | null;
      author?: {
        name?: string | null;
        url?: string | null;
        iconUrl?: string | null;
      } | null;
      title?: string | null;
      url?: string | null;
      description?: string | null;
      thumbnail?: {
        url?: string | null;
      } | null;
      image?: {
        url?: string | null;
      } | null;
      footer?: {
        text?: string | null;
        iconUrl?: string | null;
      } | null;
    }>;
    splitOptions?: {
      splitChar?: string | null;
      appendChar?: string | null;
      prependChar?: string | null;
    } | null;
    formatter?: {
      formatTables?: boolean | null;
      stripImages?: boolean | null;
      disabledImageLinkPreviews?: boolean | null;
      ignoreNewLines?: boolean | null;
    } | null;
    enablePlaceholderFallback?: boolean | null;
    customPlaceholders?: CustomPlaceholder[] | null;
    mentions?: {
      targets?: Array<{
        id: string;
        type: "role" | "user";
        filters?: {
          expression: Record<string, any>;
        } | null;
      }> | null;
    } | null;
  };
}

const UpdateDiscordChannelConnectionOutputSchema = object({
  result: FeedConnectionSchema,
}).required();

export type UpdateDiscordChannelConnectionOutput = InferType<
  typeof UpdateDiscordChannelConnectionOutputSchema
>;

export const updateDiscordChannelConnection = async (
  options: UpdateDiscordChannelConnectionInput
): Promise<UpdateDiscordChannelConnectionOutput> => {
  const res = await fetchRest(
    `/api/v1/user-feeds/${options.feedId}/connections/discord-channels/${options.connectionId}`,
    {
      validateSchema: UpdateDiscordChannelConnectionOutputSchema,
      requestOptions: {
        method: "PATCH",
        body: JSON.stringify(options.details),
      },
    }
  );

  return res as UpdateDiscordChannelConnectionOutput;
};

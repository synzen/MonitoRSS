import { InferType, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { FeedConnectionSchema } from "@/types";

export interface CreateDiscordChannelConnectionInput {
  feedId: string;
  details: {
    name: string;
    channelId?: string;
    threadCreationMethod?: "new-thread";
    webhook?: {
      id: string;
      name?: string | null;
      iconUrl?: string | null;
      threadId?: string | null;
    };
    applicationWebhook?: {
      channelId: string;
      name: string;
      iconUrl?: string | null;
      threadId?: string | null;
    };
    content?: string | null;
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
      timestamp?: string | null;
    }>;
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
        media?: {
          url: string;
        };
      } | null;
    }> | null;
    placeholderLimits?: Array<{
      placeholder: string;
      characterCount: number;
      appendString?: string | null;
    }> | null;
    formatter?: {
      formatTables?: boolean | null;
      stripImages?: boolean | null;
      disableImageLinkPreviews?: boolean | null;
      ignoreNewLines?: boolean | null;
    } | null;
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

import { InferType, object } from "yup";
import { FeedSchema, Feed } from "@/types";
import fetchRest from "@/utils/fetchRest";

export interface UpdateFeedInput {
  feedId: string;
  details: {
    text?: Feed["text"];
    title?: string;
    channelId?: string;
    webhook?: {
      id?: string;
      name?: string;
      iconUrl?: string;
    };
    filters?: Array<{ category: string; value: string }>;
    checkTitles?: boolean;
    checkDates?: boolean;
    imgPreviews?: boolean;
    imgLinksExistence?: boolean;
    formatTables?: boolean;
    directSubscribers?: boolean;
    splitMessage?: boolean;
    ncomparisons?: string[];
    pcomparisons?: string[];
    embeds?: Array<{
      title?: string | null;
      description?: string | null;
      url?: string | null;
      color?: string | null;
      footer?: {
        text?: string | null;
        iconUrl?: string | null;
      } | null;
      author?: {
        name?: string | null;
        url?: string | null;
        iconUrl?: string | null;
      } | null;
      thumbnail?: {
        url?: string | null;
      } | null;
      image?: {
        url?: string | null;
      } | null;
      timestamp?: "now" | "article";
    }>;
  };
}

const UpdatFeedOutputSchema = object({
  result: FeedSchema,
});

export type UpdateFeedOutput = InferType<typeof UpdatFeedOutputSchema>;

export const updateFeed = async (options: UpdateFeedInput): Promise<UpdateFeedOutput> => {
  const res = await fetchRest(`/api/v1/feeds/${options.feedId}`, {
    requestOptions: {
      method: "PATCH",
      body: JSON.stringify(options.details),
    },
    validateSchema: UpdatFeedOutputSchema,
  });

  return res as UpdateFeedOutput;
};

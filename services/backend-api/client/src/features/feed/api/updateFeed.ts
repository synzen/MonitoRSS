import { InferType, object } from 'yup';
import { FeedSchema, Feed } from '@/types';
import fetchRest from '@/utils/fetchRest';

export interface UpdateFeedInput {
  feedId: string
  details: {
    text?: Feed['text'],
    title?: string;
    channelId?: string;
    webhook?: {
      id?: string;
      name?: string;
      iconUrl?: string;
    }
    filters?: Array<{ category: string, value: string }>
    checkTitles?: boolean;
    checkDates?: boolean;
    imgPreviews?: boolean;
    imgLinksExistence?: boolean;
    formatTables?: boolean;
    directSubscribers?: boolean;
    splitMessage?: boolean;
    ncomparisons?: string[]
    pcomparisons?: string[]
  }
}

const UpdatFeedOutputSchema = object({
  result: FeedSchema,
});

export type UpdateFeedOutput = InferType<typeof UpdatFeedOutputSchema>;

export const updateFeed = async (options: UpdateFeedInput): Promise<UpdateFeedOutput> => {
  const res = await fetchRest(
    `/api/v1/feeds/${options.feedId}`,
    {
      requestOptions: {
        method: 'PATCH',
        body: JSON.stringify(options.details),
      },
      validateSchema: UpdatFeedOutputSchema,
    },
  );

  return res as UpdateFeedOutput;
};

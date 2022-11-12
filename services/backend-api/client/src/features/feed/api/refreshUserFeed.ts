import { InferType, object } from 'yup';
import fetchRest from '../../../utils/fetchRest';
import { UserFeedSchema } from '../types';

export interface RefreshUserFeedInput {
  feedId: string
}

const RefreshUserFeedOutputSchema = object({
  result: UserFeedSchema,
}).required();

export type RefreshUserFeedOutput = InferType<typeof RefreshUserFeedOutputSchema>;

export const refreshUserFeed = async (options: RefreshUserFeedInput): Promise<
RefreshUserFeedOutput
> => {
  const res = await fetchRest(
    `/api/v1/user-feeds/${options.feedId}/retry`,
    {
      validateSchema: RefreshUserFeedOutputSchema,
    },
  );

  return res as RefreshUserFeedOutput;
};

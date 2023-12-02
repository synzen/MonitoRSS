import { InferType, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { UserFeedDisabledCode, UserFeedSchema } from "../types";

export interface UpdateUserFeedInput {
  feedId: string;
  data: {
    title?: string;
    url?: string;
    disabledCode?: UserFeedDisabledCode.Manual | null;
    passingComparisons?: string[];
    blockingComparisons?: string[];
    formatOptions?: {
      dateFormat?: string;
      dateTimezone?: string;
      dateLocale?: string;
    };
    dateCheckOptions?: {
      oldArticleDateDiffMsThreshold?: number;
    };
    shareManageOptions?: {
      invites?: Array<{
        discordUserId: string;
      }>;
    };
    userRefreshRateSeconds?: number;
  };
}

const UpdateUserFeedOutputSchema = object({
  result: UserFeedSchema,
}).required();

export type UpdateUserFeedOutput = InferType<typeof UpdateUserFeedOutputSchema>;

export const updateUserFeed = async ({
  data,
  feedId,
}: UpdateUserFeedInput): Promise<UpdateUserFeedOutput> => {
  const res = await fetchRest(`/api/v1/user-feeds/${feedId}`, {
    requestOptions: {
      method: "PATCH",
      body: JSON.stringify(data),
    },
    validateSchema: UpdateUserFeedOutputSchema,
  });

  return res as UpdateUserFeedOutput;
};

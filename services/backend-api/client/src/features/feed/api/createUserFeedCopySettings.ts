import fetchRest from "../../../utils/fetchRest";
import { CopyableUserFeedSettings } from "../constants/copyableUserFeedSettings";

export interface CreateUserFeedCopySettingsInput {
  feedId: string;
  data: {
    settings: CopyableUserFeedSettings[];
    targetFeedIds: string[];
  };
}

export const createUserFeedCopySettings = async ({
  feedId,
  data,
}: CreateUserFeedCopySettingsInput) => {
  await fetchRest(`/api/v1/user-feeds/${feedId}/copy-settings`, {
    requestOptions: {
      method: "POST",
      body: JSON.stringify(data),
    },
    skipJsonParse: true,
  });
};
